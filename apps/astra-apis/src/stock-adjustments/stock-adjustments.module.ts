import {Module} from '@nestjs/common';
import {RavenDocumentStoreProvider} from '../infrastructure/ravendb/document-store.provider';
import {RavenDbModule} from '../infrastructure/ravendb/ravendb.module';
import {StockAdjustmentsController} from './stock-adjustments.controller';
import {StockAdjustmentsService} from './stock-adjustments.service';

@Module({
  imports: [RavenDbModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService, RavenDocumentStoreProvider],
  exports: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
