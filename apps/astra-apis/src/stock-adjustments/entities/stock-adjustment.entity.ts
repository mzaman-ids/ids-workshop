import type {AdjustmentReasonCode, AdjustmentType} from '@ids/data-models';
import {IdsBaseEntity} from '../../common/entities/ids-base.entity';

export class StockAdjustment extends IdsBaseEntity {
  public adjustmentNumber!: string;
  public locationId!: string;
  public partNumber!: string;
  public partDescriptionSnapshot!: string;
  public type!: AdjustmentType;
  public quantity!: number;
  public quantityDelta!: number;
  public reasonCode!: AdjustmentReasonCode;
  public notes?: string | null;
}
