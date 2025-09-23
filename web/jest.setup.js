import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return ''
  },
}))

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
  ThemeProvider: ({ children }) => children,
}))

// Mock environment variables
process.env.USERS_CONFIG = JSON.stringify([
  {
    id: 'yuksel',
    name: 'Yuksel',
    username: 'yuksel',
    password: '123',
    dataSheetName: 'YukselData',
    referenceSheetName: 'Reference Values'
  }
])
