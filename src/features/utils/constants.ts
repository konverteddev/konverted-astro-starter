export const IS_CLIENT = typeof window !== "undefined";
export const IS_SERVER = typeof window === "undefined";
export const IS_DEV = import.meta.env.DEV;
