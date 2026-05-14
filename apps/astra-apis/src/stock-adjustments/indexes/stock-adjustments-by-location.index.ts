import {AbstractJavaScriptIndexCreationTask} from 'ravendb';
import type {StockAdjustment} from '../entities/stock-adjustment.entity';

type StockAdjustmentsEntry = {
  locationId: string;
  partNumber: string;
  type: string;
  reasonCode: string;
  partDescriptionSnapshot: string;
};

export class StockAdjustments_ByLocation extends AbstractJavaScriptIndexCreationTask<
  StockAdjustment,
  StockAdjustmentsEntry
> {
  public constructor() {
    super();
    this.map('stock-adjustments', (adj) => ({
      locationId: adj.locationId,
      partNumber: adj.partNumber,
      type: adj.type,
      reasonCode: adj.reasonCode,
      partDescriptionSnapshot: adj.partDescriptionSnapshot,
    }));
  }
}
