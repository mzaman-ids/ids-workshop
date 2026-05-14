import {ApiProperty} from '@nestjs/swagger';
import {IsInt, IsNotEmpty, IsNumber, IsString, Min} from 'class-validator';

export class PoLineCreateDto {
  @ApiProperty({description: 'Part number'})
  @IsNotEmpty()
  @IsString()
  partNumber!: string;

  @ApiProperty({description: 'Quantity to order', minimum: 1})
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({description: 'Unit cost in dollars (e.g. 8.50)', minimum: 0})
  @IsNumber()
  @Min(0)
  unitCostDollars!: number;
}
