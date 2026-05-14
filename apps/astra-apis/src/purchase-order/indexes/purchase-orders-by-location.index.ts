import {AbstractJavaScriptIndexCreationTask} from 'ravendb';
import type {PurchaseOrder} from '../entities/purchase-order.entity';

type PurchaseOrdersEntry = {
  locationId: string;
  status: string;
  poNumber: string;
  vendorCode: string;
  vendorName: string;
};

export class PurchaseOrders_ByLocation extends AbstractJavaScriptIndexCreationTask<
  PurchaseOrder,
  PurchaseOrdersEntry
> {
  public constructor() {
    super();
    this.map('purchase-orders', (po) => ({
      locationId: po.locationId,
      status: po.status,
      poNumber: po.poNumber,
      vendorCode: po.vendorSnapshot.code,
      vendorName: po.vendorSnapshot.name,
    }));
  }
}
