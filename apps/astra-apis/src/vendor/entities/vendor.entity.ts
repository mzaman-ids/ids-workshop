import {IdsBaseEntity} from '../../common/entities/ids-base.entity';

export class Vendor extends IdsBaseEntity {
  public code!: string;
  public name!: string;
  public terms?: string | null;
}
