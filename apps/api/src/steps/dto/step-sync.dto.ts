import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class StepBucketDto {
  @IsDateString()
  bucketStart!: string;

  @IsDateString()
  bucketEnd!: string;

  @IsInt()
  @Min(0)
  steps!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  distanceMeters?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeEnergy?: number;

  @IsString()
  source!: string;

  @IsOptional()
  @IsBoolean()
  isManual?: boolean;
}

export class StepSyncDto {
  @ValidateNested({ each: true })
  @Type(() => StepBucketDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  buckets!: StepBucketDto[];

  @IsString()
  clientBatchId!: string;
}
