/**
 * Type-safe helpers for Supabase queries with joins
 * 
 * These types handle the nested objects returned by Supabase 
 * when using select() with relationship joins like:
 * .select(`*, customers (name, area)`)
 */

// Generic type for extracting nested relation data
export type JoinedRelation<T> = T | null;

// Common joined types for frequently used patterns
export interface CustomerJoin {
  name: string;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  route_id?: string | null;
}

export interface CattleJoin {
  tag_number: string;
  name?: string | null;
  breed?: string;
  status?: string | null;
  lactation_status?: string | null;
}

export interface ProductJoin {
  name: string;
  base_price: number;
  category?: string;
  unit?: string;
}

export interface EmployeeJoin {
  name: string;
  phone?: string | null;
  role?: string;
}

/**
 * Safely extract a property from a joined relation
 * Handles both single objects and arrays returned by Supabase
 */
export function getJoinedValue<T, K extends keyof T>(
  relation: JoinedRelation<T> | T[] | unknown,
  key: K,
  defaultValue: T[K] | string = "Unknown" as T[K]
): T[K] {
  if (!relation) return defaultValue as T[K];
  
  // Handle array case (one-to-many relations)
  if (Array.isArray(relation)) {
    return relation.length > 0 ? (relation[0] as T)[key] : defaultValue as T[K];
  }
  
  // Handle object case (one-to-one or many-to-one)
  if (typeof relation === 'object') {
    return ((relation as T)[key] ?? defaultValue) as T[K];
  }
  
  return defaultValue as T[K];
}

/**
 * Type guard to check if a relation exists and is an object
 */
export function hasJoinedRelation<T>(
  relation: JoinedRelation<T> | T[] | unknown
): relation is T {
  return relation !== null && typeof relation === 'object' && !Array.isArray(relation);
}

/**
 * Safely get customer name from a joined customers relation
 */
export function getCustomerName(
  customers: JoinedRelation<CustomerJoin> | unknown,
  defaultName = "Unknown"
): string {
  return getJoinedValue<CustomerJoin, 'name'>(
    customers as JoinedRelation<CustomerJoin>,
    'name',
    defaultName
  );
}

/**
 * Safely get customer area from a joined customers relation
 */
export function getCustomerArea(
  customers: JoinedRelation<CustomerJoin> | unknown
): string | null {
  return getJoinedValue<CustomerJoin, 'area'>(
    customers as JoinedRelation<CustomerJoin>,
    'area',
    null
  );
}

/**
 * Safely get cattle tag number from a joined cattle relation
 */
export function getCattleTag(
  cattle: JoinedRelation<CattleJoin> | unknown,
  defaultTag = "Unknown"
): string {
  return getJoinedValue<CattleJoin, 'tag_number'>(
    cattle as JoinedRelation<CattleJoin>,
    'tag_number',
    defaultTag
  );
}

/**
 * Safely get cattle name from a joined cattle relation
 */
export function getCattleName(
  cattle: JoinedRelation<CattleJoin> | unknown
): string | null {
  return getJoinedValue<CattleJoin, 'name'>(
    cattle as JoinedRelation<CattleJoin>,
    'name',
    null
  );
}

/**
 * Safely get product name from a joined products relation
 */
export function getProductName(
  products: JoinedRelation<ProductJoin> | unknown,
  defaultName = "Unknown Product"
): string {
  return getJoinedValue<ProductJoin, 'name'>(
    products as JoinedRelation<ProductJoin>,
    'name',
    defaultName
  );
}

/**
 * Safely get product base price from a joined products relation
 */
export function getProductPrice(
  product: JoinedRelation<ProductJoin> | unknown,
  defaultPrice = 0
): number {
  return getJoinedValue<ProductJoin, 'base_price'>(
    product as JoinedRelation<ProductJoin>,
    'base_price',
    defaultPrice
  );
}
