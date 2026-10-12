import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoginDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
}
export class ProfileDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MaxLength(30) phone: string;
  @IsString() @MaxLength(300) address: string;
}
export class FavoriteDto {
  @IsBoolean() saved: boolean;
}
export class LineDto {
  @IsString() @MaxLength(80) productId: string;
  @IsString() @MaxLength(20) size: string;
  @IsInt() @Min(1) @Max(20) quantity: number;
}
export class CheckoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LineDto)
  items: LineDto[];
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @Matches(/^\+?[\d\s()-]{10,25}$/) phone: string;
  @IsString() @MaxLength(300) address: string;
  @IsString() @MaxLength(500) comment: string;
  @IsIn(['courier', 'pickup']) delivery: 'courier' | 'pickup';
  @IsIn(['on_receipt']) payment: 'on_receipt';
  @IsString() @Matches(/^[a-zA-Z0-9-]{16,80}$/) requestId: string;
}
export class StatusDto {
  @IsIn(['new', 'confirmed', 'shipped', 'delivered', 'cancelled']) status:
    | 'new'
    | 'confirmed'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
}
export class ProductDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(80) brand: string;
  @IsIn(['sneakers', 'shoes', 'clothing', 'accessories']) category:
    | 'sneakers'
    | 'shoes'
    | 'clothing'
    | 'accessories';
  @IsIn(['women', 'men', 'unisex']) gender: 'women' | 'men' | 'unisex';
  @IsInt() @Min(1) @Max(1000000) price: number;
  @IsOptional() @IsInt() @Min(1) @Max(1000000) oldPrice: number | null;
  @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @IsString() @MaxLength(500) material: string;
  @IsString() @MaxLength(80) color: string;
  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) colorHex: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  images: string[];
  @IsObject() stock: Record<string, number>;
  @IsString() @MaxLength(30) badge: string;
  @IsBoolean() active: boolean;
}
