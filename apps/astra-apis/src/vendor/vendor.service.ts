import {DEFAULT_PAGE_SIZE, type PagedResponseDto, toPagedDto} from '@ids/data-models';
import {ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {createIdsBaseEntity, touchIdsBaseEntity} from '../common/entities/ids-base.entity';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {VendorCreateDto, VendorCreateResponseDto} from './dto/vendor-create.dto';
import type {VendorUpdateDto} from './dto/vendor-update.dto';
import {Vendor} from './entities/vendor.entity';

@Injectable()
export class VendorService {
  public constructor(private readonly _sessionFactory: RavenSessionFactory) {}

  public async create(dto: VendorCreateDto, userId: string): Promise<VendorCreateResponseDto> {
    using session = this._sessionFactory.openSession();

    const all: Vendor[] = await session.query<Vendor>({collection: 'vendors'}).all();
    const exists = all.some((v) => v.code.toLowerCase() === dto.code.toLowerCase());
    if (exists) {
      throw new ConflictException(`Vendor with code "${dto.code}" already exists`);
    }

    const entity: Vendor = {
      ...createIdsBaseEntity(userId),
      id: `vendors/${dto.code}`,
      code: dto.code,
      name: dto.name,
      terms: dto.terms ?? null,
    };

    await session.store(entity, entity.id);
    await session.saveChanges();
    return this._toResponseDto(entity);
  }

  public async findAll(options?: {
    searchTerm?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResponseDto<VendorCreateResponseDto>> {
    const {searchTerm, page = 1, pageSize = DEFAULT_PAGE_SIZE} = options ?? {};

    using session = this._sessionFactory.openSession();
    const all: Vendor[] = await session.query<Vendor>({collection: 'vendors'}).all();

    const filtered = all.filter((vendor) => {
      if (!searchTerm) {
        return true;
      }
      const tokens = searchTerm
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0);
      const haystack = `${vendor.code} ${vendor.name}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    return toPagedDto(
      items.map((v) => this._toResponseDto(v)),
      page,
      pageSize,
      filtered.length,
    );
  }

  public async findOne(id: string): Promise<VendorCreateResponseDto> {
    const docId = this._toDocId(id);
    using session = this._sessionFactory.openSession();
    const vendor: Vendor | null = await session.load<Vendor>(docId);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" not found`);
    }
    return this._toResponseDto(vendor);
  }

  public async update(
    id: string,
    dto: VendorUpdateDto,
    userId: string,
  ): Promise<VendorCreateResponseDto> {
    const docId = this._toDocId(id);
    using session = this._sessionFactory.openSession();
    const vendor: Vendor | null = await session.load<Vendor>(docId);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" not found`);
    }

    if (dto.name !== undefined) {
      vendor.name = dto.name;
    }
    if (dto.terms !== undefined) {
      vendor.terms = dto.terms;
    }
    touchIdsBaseEntity(vendor, userId);

    await session.store(vendor, docId);
    await session.saveChanges();
    return this._toResponseDto(vendor);
  }

  private _toDocId(id: string): string {
    return id.startsWith('vendors/') ? id : `vendors/${id}`;
  }

  private _toResponseDto(vendor: Vendor): VendorCreateResponseDto {
    return {
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      terms: vendor.terms ?? null,
    };
  }
}
