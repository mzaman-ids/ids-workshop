import type {
  DbPurchaseOrderDetail,
  DbPurchaseOrderListItem,
  Money,
  PagedResponseDto,
  PoStatus,
} from '@ids/data-models';
import {DEFAULT_PAGE_SIZE, multiplyMoney, sumMoney, toMoney, toPagedDto} from '@ids/data-models';
import type {OnModuleInit} from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {createIdsBaseEntity, touchIdsBaseEntity} from '../common/entities/ids-base.entity';
import {RavenDocumentStoreProvider} from '../infrastructure/ravendb/document-store.provider';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {Part, PartLocation} from '../part/entities/part.entity';
import type {Vendor} from '../vendor/entities/vendor.entity';
import type {PoCreateDto} from './dto/po-create.dto';
import type {PoListQueryDto} from './dto/po-list.query.dto';
import {PoLine, PurchaseOrder} from './entities/purchase-order.entity';
import {PurchaseOrders_ByLocation} from './indexes/purchase-orders-by-location.index';

const DEFAULT_CURRENCY = 'CAD' as const;

@Injectable()
export class PurchaseOrderService implements OnModuleInit {
  private readonly _logger = new Logger(PurchaseOrderService.name);

  public constructor(
    private readonly _sessionFactory: RavenSessionFactory,
    private readonly _storeProvider: RavenDocumentStoreProvider,
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await new PurchaseOrders_ByLocation().execute(this._storeProvider.getStore());
    } catch (error) {
      this._logger.warn(
        'Failed to create PurchaseOrders/ByLocation index',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public async create(
    dto: PoCreateDto,
    locationId: string,
    userId: string,
  ): Promise<DbPurchaseOrderDetail> {
    using session = this._sessionFactory.openSession();

    const vendor: Vendor | null = await session.load<Vendor>(dto.vendorId);
    if (!vendor) {
      throw new BadRequestException(`Vendor "${dto.vendorId}" not found`);
    }

    const lines: PoLine[] = [];
    for (let i = 0; i < dto.lines.length; i++) {
      const lineDto = dto.lines[i];
      const part: Part | null = await session.load<Part>(`parts/${lineDto.partNumber}`);
      if (!part) {
        throw new BadRequestException(`Part "${lineDto.partNumber}" not found`);
      }
      const unitCost: Money = toMoney(lineDto.unitCostDollars, DEFAULT_CURRENCY);
      const totalCost: Money = multiplyMoney(unitCost, lineDto.quantity);
      const line = new PoLine();
      line.lineNumber = i + 1;
      line.partNumber = lineDto.partNumber;
      line.partDescriptionSnapshot = part.description;
      line.quantity = lineDto.quantity;
      line.unitCost = unitCost;
      line.totalCost = totalCost;
      lines.push(line);
    }

    const grandTotal: Money = sumMoney(
      lines.map((l) => l.totalCost),
      DEFAULT_CURRENCY,
    );

    const year = new Date().getFullYear();
    const existing: PurchaseOrder[] = await session
      .query<PurchaseOrder>({collection: 'purchase-orders'})
      .all();
    const thisYearCount = existing.filter((po) => po.poNumber.startsWith(`PO-${year}-`)).length;
    const poNumber = `PO-${year}-${String(thisYearCount + 1).padStart(4, '0')}`;

    const entity: PurchaseOrder = {
      ...createIdsBaseEntity(userId),
      id: `purchase-orders/${poNumber}`,
      poNumber,
      locationId,
      vendorId: dto.vendorId,
      vendorSnapshot: {code: vendor.code, name: vendor.name},
      status: 'draft' as PoStatus,
      lines,
      lineCount: lines.length,
      grandTotal,
      notes: dto.notes ?? null,
    };

    await session.store(entity, entity.id);
    await session.saveChanges();

    return this._toDetail(entity);
  }

  public async findAll(query: PoListQueryDto): Promise<PagedResponseDto<DbPurchaseOrderListItem>> {
    const {locationId, searchTerm, status, page = 1, pageSize = DEFAULT_PAGE_SIZE} = query;

    using session = this._sessionFactory.openSession();
    const all: PurchaseOrder[] = await session
      .query<PurchaseOrder>({collection: 'purchase-orders'})
      .all();

    const filtered = all.filter((po) => {
      if (po.locationId !== locationId) {
        return false;
      }
      if (status && po.status !== status) {
        return false;
      }
      if (searchTerm) {
        const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const hay =
          `${po.poNumber} ${po.vendorSnapshot.code} ${po.vendorSnapshot.name}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) {
          return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    return toPagedDto(
      items.map((po) => this._toListItem(po)),
      page,
      pageSize,
      filtered.length,
    );
  }

  public async findOne(id: string): Promise<DbPurchaseOrderDetail> {
    using session = this._sessionFactory.openSession();
    const po: PurchaseOrder | null = await session.load<PurchaseOrder>(id);
    if (!po) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }
    return this._toDetail(po);
  }

  public async confirm(id: string, userId: string): Promise<DbPurchaseOrderDetail> {
    using session = this._sessionFactory.openSession();

    const po: PurchaseOrder | null = await session.load<PurchaseOrder>(id);
    if (!po) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }
    if (po.status !== 'draft') {
      throw new ConflictException(`Cannot confirm a PO with status "${po.status}"`);
    }

    for (const line of po.lines) {
      const part: Part | null = await session.load<Part>(`parts/${line.partNumber}`);
      if (part) {
        part.totalOnOrder += line.quantity;
        await session.store(part, part.id);
      }
    }

    po.status = 'confirmed';
    touchIdsBaseEntity(po, userId);
    await session.store(po, po.id);
    await session.saveChanges();

    return this._toDetail(po);
  }

  public async receive(id: string, userId: string): Promise<DbPurchaseOrderDetail> {
    using session = this._sessionFactory.openSession();

    const po: PurchaseOrder | null = await session.load<PurchaseOrder>(id);
    if (!po) {
      throw new NotFoundException(`Purchase order "${id}" not found`);
    }
    if (po.status !== 'confirmed') {
      throw new ConflictException(`Cannot receive a PO with status "${po.status}"`);
    }

    for (const line of po.lines) {
      const part: Part | null = await session.load<Part>(`parts/${line.partNumber}`);
      if (part) {
        part.totalOnOrder = Math.max(0, part.totalOnOrder - line.quantity);
        part.totalOnHand += line.quantity;
        part.totalAvailable = part.totalOnHand + part.totalOnOrder - part.totalCommitted;
        part.totalNetAvailable = part.totalAvailable - part.totalSpecialOrderCommitted;

        const partLocation: PartLocation | undefined = part.locations.find(
          (l) => l.location.id === po.locationId,
        );
        if (partLocation) {
          partLocation.numOnHand += line.quantity;
          partLocation.numAvailable =
            partLocation.numOnHand + partLocation.numOnOrder - partLocation.numCommitted;
          const mainBin = partLocation.bins.find((b) => b.isMain) ?? partLocation.bins[0];
          if (mainBin) {
            mainBin.numOnHand += line.quantity;
          }
        }

        await session.store(part, part.id);
      }
    }

    po.status = 'received';
    touchIdsBaseEntity(po, userId);
    await session.store(po, po.id);
    await session.saveChanges();

    return this._toDetail(po);
  }

  private _toListItem(po: PurchaseOrder): DbPurchaseOrderListItem {
    return {
      id: po.id,
      poNumber: po.poNumber,
      locationId: po.locationId,
      vendorCode: po.vendorSnapshot.code,
      vendorName: po.vendorSnapshot.name,
      status: po.status,
      lineCount: po.lineCount,
      grandTotal: po.grandTotal,
      createdDate:
        po.createdDate instanceof Date ? po.createdDate.toISOString() : String(po.createdDate),
    };
  }

  private _toDetail(po: PurchaseOrder): DbPurchaseOrderDetail {
    return {
      id: po.id,
      poNumber: po.poNumber,
      locationId: po.locationId,
      vendorId: po.vendorId,
      vendorSnapshot: po.vendorSnapshot,
      status: po.status,
      lines: po.lines.map((l) => ({
        lineNumber: l.lineNumber,
        partNumber: l.partNumber,
        partDescriptionSnapshot: l.partDescriptionSnapshot,
        quantity: l.quantity,
        unitCost: l.unitCost,
        totalCost: l.totalCost,
      })),
      lineCount: po.lineCount,
      grandTotal: po.grandTotal,
      notes: po.notes,
      createdDate:
        po.createdDate instanceof Date ? po.createdDate.toISOString() : String(po.createdDate),
      createdBy: po.createdBy,
      updatedDate:
        po.updatedDate instanceof Date ? po.updatedDate.toISOString() : String(po.updatedDate),
      isDeleted: po.isDeleted,
    };
  }
}
