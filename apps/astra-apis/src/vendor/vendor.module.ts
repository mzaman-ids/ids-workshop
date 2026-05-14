import {Module} from '@nestjs/common';
import {RavenDbModule} from '../infrastructure/ravendb/ravendb.module';
import {VendorController} from './vendor.controller';
import {VendorService} from './vendor.service';

@Module({
  imports: [RavenDbModule],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
