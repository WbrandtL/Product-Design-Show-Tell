/** Small dev/prod flag, mirroring the convention electron-vite templates use. */
export const is = {
  dev: process.env['NODE_ENV'] !== 'production' && !process.env['ELECTRON_IS_PACKAGED']
}
