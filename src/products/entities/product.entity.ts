import { IsPositive, IsString } from 'class-validator';
import { Brand } from '../../brands/entities/brand.entity';
import { Category } from '../../categories/entities/category.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import {
  PrimaryGeneratedColumn,
  Index,
  Column,
  ManyToOne,
  OneToMany,
  Entity,
  JoinColumn,
} from 'typeorm';
import { Size } from '../../sizes/entities/size.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  @Index()
  product_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  @IsString()
  name: string;

  @Column({ type: 'varchar', length: 255 })
  @IsString()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @IsPositive()
  current_price: number;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => Supplier, (supplier) => supplier.products)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => Brand, (brand) => brand.products)
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @OneToMany(() => Size, (size) => size.product)
  sizes: Size[];
}
