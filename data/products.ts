import { Product } from '../types';
import { hematologiaProducts } from './hematologia';

// El sistema está ahora configurado para usar únicamente el almacén de HEMATOLOGIA.
export const warehouseName = 'HEMATOLOGIA';
export const productList: Product[] = hematologiaProducts;
