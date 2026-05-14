import type {Money, PoStatus} from '@ids/data-models';
import {IdsBaseEntity} from '../../common/entities/ids-base.entity';

export class PoLine {
  public lineNumber!: number;
  public partNumber!: string;
  public partDescriptionSnapshot!: string;
  public quantity!: number;
  public unitCost!: Money;
  public totalCost!: Money;
}

export class PurchaseOrder extends IdsBaseEntity {
  public poNumber!: string;
  public locationId!: string;
  public vendorId!: string;
  public vendorSnapshot!: {code: string; name: string};
  public status!: PoStatus;
  public lines!: PoLine[];
  public lineCount!: number;
  public grandTotal!: Money;
  public notes?: string | null;
}
