import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class AdjustmentCreateDto {
  @ApiProperty({description: 'Part number to adjust'})
  @IsNotEmpty()
  @IsString()
  partNumber!: string;

  @ApiProperty({description: 'Location document ID (e.g. locations/LOC_AAA)'})
  @IsNotEmpty()
  @IsString()
  locationId!: string;

  @ApiProperty({enum: ['add', 'remove'], description: 'Add or remove inventory'})
  @IsIn(['add', 'remove'])
  type!: 'add' | 'remove';

  @ApiProperty({description: 'Positive quantity to adjust', minimum: 1})
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    enum: ['CYCLE_COUNT', 'DAMAGE', 'THEFT', 'FOUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'],
  })
  @IsEnum(['CYCLE_COUNT', 'DAMAGE', 'THEFT', 'FOUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'])
  reasonCode!: string;

  @ApiPropertyOptional({
    description: 'Notes — required when reasonCode is OTHER',
    maxLength: 500,
    nullable: true,
  })
  @ValidateIf((o) => o.reasonCode === 'OTHER')
  @IsNotEmpty({message: 'notes is required when reasonCode is OTHER'})
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
