import {Type} from 'class-transformer';
import {IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested} from 'class-validator';

export class NetworkEventDto {
  @IsString()
  public id!: string;

  @IsString()
  public sessionId!: string;

  @IsNumber()
  public ts!: number;

  @IsString()
  public tsHuman!: string;

  @IsString()
  public method!: string;

  @IsString()
  public url!: string;

  @IsNumber()
  public status!: number;

  @IsObject()
  public requestHeaders!: Record<string, string>;

  @IsOptional()
  public reqBody: unknown;

  @IsOptional()
  public resBody: unknown;

  @IsNumber()
  public durationMs!: number;

  @IsString()
  public userId!: string;

  @IsString()
  public locationId!: string;

  @IsString()
  public locationName!: string;
}

export class ConsoleEventDto {
  @IsString()
  public id!: string;

  @IsString()
  public sessionId!: string;

  @IsNumber()
  public ts!: number;

  @IsString()
  public tsHuman!: string;

  @IsString()
  public level!: 'error' | 'warn' | 'rejection';

  @IsString()
  public message!: string;

  @IsOptional()
  @IsString()
  public stack?: string;
}

export class UserContextDto {
  @IsString()
  public userId!: string;

  @IsString()
  public locationId!: string;

  @IsString()
  public locationName!: string;
}

export class FormStateEntryDto {
  @IsString()
  public id!: string;

  @IsObject()
  public values!: Record<string, unknown>;
}

export class SnapshotDto {
  @IsString()
  public ts!: string;

  @IsString()
  public url!: string;

  @IsString()
  public title!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UserContextDto)
  public user!: UserContextDto | null;

  @IsString()
  public visibleText!: string;

  @IsArray()
  @IsString({each: true})
  public errorElements!: string[];

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => FormStateEntryDto)
  public formState!: FormStateEntryDto[];

  @IsArray()
  public recentFindings!: unknown[];
}

export class SyncPayloadDto {
  @IsString()
  public sessionId!: string;

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => NetworkEventDto)
  public networkEvents!: NetworkEventDto[];

  @IsArray()
  @ValidateNested({each: true})
  @Type(() => ConsoleEventDto)
  public consoleEvents!: ConsoleEventDto[];

  @ValidateNested()
  @Type(() => SnapshotDto)
  public snapshot!: SnapshotDto;
}
