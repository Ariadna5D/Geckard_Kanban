/**
 * Verbos de permiso
 */
export enum Action {
  Manage = 'manage', // Permiso total
  Create = 'create', // Permiso para crear nuevos recursos
  Read = 'read', // Permiso para leer recursos existentes
  Update = 'update', // Permiso para modificar recursos existentes
  Delete = 'delete', // Permiso para eliminar recursos existentes
}
