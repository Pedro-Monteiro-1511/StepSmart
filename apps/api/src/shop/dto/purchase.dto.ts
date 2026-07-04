import { IsUUID } from 'class-validator';

export class PurchaseDto {
  @IsUUID()
  itemId!: string;
}
