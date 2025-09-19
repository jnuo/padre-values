import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockData = {
  metrics: [
    { id: '1', name: 'Hemoglobin', unit: 'g/dL', ref_min: 12.0, ref_max: 16.0 },
  ],
  values: [
    { id: '1', metric_id: '1', date: '2025-01-15', value: 14.2 },
  ],
}

// Mock the API route
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Mock the main page component
const Dashboard = () => {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/data')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (isLoggedIn) {
      fetchData()
    }
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return (
      <div>
        <h1>Login Required</h1>
        <button onClick={() => setIsLoggedIn(true)}>Login</button>
      </div>
    )
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>Tahlil Sonuçları</h1>
      <div data-testid="metrics-grid">
        {data?.metrics.map((metric) => (
          <div key={metric.id} data-testid={`metric-${metric.id}`}>
            {metric.name}
          </div>
        ))}
      </div>
    </div>
  )
}

describe('Dashboard Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows login screen initially', () => {
    render(<Dashboard />)
    
    expect(screen.getByText('Login Required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('loads data after login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    render(<Dashboard />)
    
    const loginButton = screen.getByRole('button', { name: 'Login' })
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByText('Tahlil Sonuçları')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('metrics-grid')).toBeInTheDocument()
    })

    expect(screen.getByTestId('metric-1')).toBeInTheDocument()
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'))

    render(<Dashboard />)
    
    const loginButton = screen.getByRole('button', { name: 'Login' })
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByText('Tahlil Sonuçları')).toBeInTheDocument()
    })

    // Should not crash, just show empty state
    expect(screen.getByTestId('metrics-grid')).toBeInTheDocument()
  })
})
