export const Platform = {
  OS: 'ios' as string,
  Version: '17.0',
  isPad: false,
  constants: {
    systemName: 'iOS',
    interfaceIdiom: 'phone',
  },
};

export const Dimensions = {
  get: (_dim: string) => ({ width: 390, height: 844 }),
};
