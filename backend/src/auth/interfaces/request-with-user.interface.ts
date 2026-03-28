// Importamos el tipo Request nativo de Express
import { Request } from 'express';

// Extendemos la interfaz base añadiendo lo que inyecta tu JWT
export interface RequestWithUser extends Request {
  user: {
    id: string;
    // Si tu token guarda más cosas (como el rol o el email), ponlas aquí.
    // Por ejemplo:
    // email: string;
    // role: string;
  };
}
