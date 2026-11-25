module.exports = {
  preset: 'jest-expo',
  // La primera transformación de módulos pesados (expo-notifications, iconos) supera los 5 s por defecto.
  testTimeout: 30000,
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
