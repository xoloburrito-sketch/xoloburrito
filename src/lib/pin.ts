// PIN de acceso simple guardado en localStorage del dispositivo
const KEY_PIN = "pos_pin";
const KEY_AUTH = "pos_auth";
const PIN_DEFAULT = "1234";

export const obtenerPin = () =>
  (typeof window !== "undefined" && localStorage.getItem(KEY_PIN)) || PIN_DEFAULT;

export const cambiarPin = (nuevo: string) => {
  localStorage.setItem(KEY_PIN, nuevo);
};

export const estaAutenticado = () =>
  typeof window !== "undefined" && sessionStorage.getItem(KEY_AUTH) === "1";

export const autenticar = () => sessionStorage.setItem(KEY_AUTH, "1");
export const cerrarSesion = () => sessionStorage.removeItem(KEY_AUTH);
