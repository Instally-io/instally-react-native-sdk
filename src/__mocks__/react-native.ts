export const Platform = {
  OS: 'ios' as string,
  Version: '17.0',
  constants: {
    systemName: 'iOS',
  },
};

export const Dimensions = {
  get: (_dim: string) => ({ width: 390, height: 844 }),
};
