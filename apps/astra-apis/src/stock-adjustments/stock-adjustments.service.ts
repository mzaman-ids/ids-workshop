import type {
  AdjustmentReasonCode,
  AdjustmentType,
  DbStockAdjustmentListItem,
} from '@ids/data-models';
import {DEFAULT_PAGE_SIZE, type PagedResponseDto, toPagedDto} from '@ids/data-models';
import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {createIdsBaseEntity} from '../common/entities/ids-base.entity';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {Part, PartLocation} from '../part/entities/part.entity';
import type {AdjustmentCreateDto} from './dto/adjustment-create.dto';
import type {AdjustmentListQueryDto} from './dto/adjustment-list.query.dto';
import {StockAdjustment} from './entities/stock-adjustment.entity';

@Injectable()
export class StockAdjustmentsService {
  public constructor(private readonly _sessionFactory: RavenSessionFactory) {}

  public async create(
    dto: AdjustmentCreateDto,
    userId: string,
  ): Promise<DbStockAdjustmentListItem> {
    using session = this._sessionFactory.openSession();

    // Load Part
    const part: Part | null = await session.load<Part>(`parts/${dto.partNumber}`);
    if (!part) {
      throw new NotFoundException(`Part "${dto.partNumber}" not found`);
    }

    // Find PartLocation
    const partLocation: PartLocation | undefined = part.locations.find(
      (l) => l.location.id === dto.locationId,
    );
    if (!partLocation) {
      throw new BadRequestException(
        `Part "${dto.partNumber}" is not stocked at location "${dto.locationId}"`,
      );
    }

    const delta: number = dto.type === 'add' ? dto.quantity : -dto.quantity;

    // Guard negative inventory
    if (delta < 0 && part.totalOnHand + delta < 0) {
      throw new BadRequestException(
        `Cannot remove ${dto.quantity} units — only ${part.totalOnHand} on hand globally`,
      );
    }
    if (delta < 0 && partLocation.numOnHand + delta < 0) {
      throw new BadRequestException(
        `Cannot remove ${dto.quantity} units — only ${partLocation.numOnHand} on hand at this location`,
      );
    }

    // Mutate Part
    partLocation.numOnHand += delta;
    partLocation.numAvailable =
      partLocation.numOnHand + partLocation.numOnOrder - partLocation.numCommitted;

    const mainBin = partLocation.bins.find((b) => b.isMain) ?? partLocation.bins[0];
    if (mainBin) {
      mainBin.numOnHand += delta;
    }

    part.totalOnHand = part.locations.reduce((sum, l) => sum + l.numOnHand, 0);
    part.totalAvailable = part.totalOnHand + part.totalOnOrder - part.totalCommitted;
    part.totalNetAvailable = part.totalAvailable - part.totalSpecialOrderCommitted;

    await session.store(part, part.id);

    // Generate adjustment number
    const year: number = new Date().getFullYear();
    const existing: StockAdjustment[] = await session
      .query<StockAdjustment>({collection: 'stock-adjustments'})
      .all();
    const thisYearCount: number = existing.filter((a) =>
      a.adjustmentNumber.startsWith(`ADJ-${year}-`),
    ).length;
    const adjustmentNumber = `ADJ-${year}-${String(thisYearCount + 1).padStart(4, '0')}`;

    const entity: StockAdjustment = {
      ...createIdsBaseEntity(userId),
      id: `stock-adjustments/${adjustmentNumber}`,
      adjustmentNumber,
      locationId: dto.locationId,
      partNumber: dto.partNumber,
      partDescriptionSnapshot: part.description,
      type: dto.type as AdjustmentType,
      quantity: dto.quantity,
      quantityDelta: delta,
      reasonCode: dto.reasonCode as AdjustmentReasonCode,
      notes: dto.notes ?? null,
    };

    await session.store(entity, entity.id);
    await session.saveChanges();

    return this._toListItem(entity);
  }

  public async findAll(
    query: AdjustmentListQueryDto,
  ): Promise<PagedResponseDto<DbStockAdjustmentListItem>> {
    const {
      locationId,
      partNumber,
      searchTerm,
      type,
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
    } = query;

    using session = this._sessionFactory.openSession();
    const all: StockAdjustment[] = await session
      .query<StockAdjustment>({collection: 'stock-adjustments'})
      .all();

    const filtered = all.filter((adj) => {
      if (adj.locationId !== locationId) {
        return false;
      }
      if (partNumber && adj.partNumber !== partNumber) {
        return false;
      }
      if (type && adj.type !== type) {
        return false;
      }
      if (searchTerm) {
        const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const hay = `${adj.partNumber} ${adj.partDescriptionSnapshot}`.toLowerCase();
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
      items.map((a) => this._toListItem(a)),
      page,
      pageSize,
      filtered.length,
    );
  }

  private _toListItem(adj: StockAdjustment): DbStockAdjustmentListItem {
    return {
      id: adj.id,
      adjustmentNumber: adj.adjustmentNumber,
      locationId: adj.locationId,
      partNumber: adj.partNumber,
      partDescriptionSnapshot: adj.partDescriptionSnapshot,
      type: adj.type,
      quantity: adj.quantity,
      quantityDelta: adj.quantityDelta,
      reasonCode: adj.reasonCode,
      notes: adj.notes,
      createdDate:
        adj.createdDate instanceof Date ? adj.createdDate.toISOString() : String(adj.createdDate),
      createdBy: adj.createdBy,
    };
  }
}
