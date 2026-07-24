export const DEVICE_PROFILE = process.env.NEXT_PUBLIC_DEVICE_PROFILE || "standard";
export const IS_HANDHELD = DEVICE_PROFILE === "handheld";
export const PRODUCT_RESULT_LIMIT = IS_HANDHELD ? 5 : 10;
export const INITIAL_PRODUCT_RESULT_LIMIT = IS_HANDHELD ? 4 : 8;

