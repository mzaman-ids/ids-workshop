import {Body, Controller, Get, HttpCode, HttpStatus, Post} from '@nestjs/common';
import {ApiOperation, ApiTags} from '@nestjs/swagger';
import {Public} from '../auth/public.decorator';
import {DoctorService} from './doctor.service';
import {SnapshotDto, SyncPayloadDto} from './dto/sync-payload.dto';

@ApiTags('doctor')
@Public()
@Controller('doctor')
export class DoctorController {
  constructor(private readonly _doctorService: DoctorService) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({summary: 'Receive browser telemetry — detect patterns, write session files'})
  public sync(@Body() dto: SyncPayloadDto): object {
    return this._doctorService.sync(dto);
  }

  @Get('snapshot')
  @ApiOperation({summary: 'Return current telemetry snapshot — used by Claude Code to diagnose'})
  public getSnapshot(): object {
    return this._doctorService.getSnapshot();
  }

  @Post('snapshot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({summary: 'Push DOM snapshot from browser'})
  public updateSnapshot(@Body() dto: SnapshotDto): void {
    this._doctorService.writeSnapshot(dto);
  }
}
