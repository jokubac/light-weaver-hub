export const MIN_SPEED = 0.001;
export const MAX_SPEED = 100;
export const clampSpeed = (value: number) => Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
export const speedToPosition = (value: number) => Math.log(clampSpeed(value) / MIN_SPEED) / Math.log(MAX_SPEED / MIN_SPEED);
export const positionToSpeed = (value: number) => MIN_SPEED * Math.pow(MAX_SPEED / MIN_SPEED, Math.min(1, Math.max(0, value)));