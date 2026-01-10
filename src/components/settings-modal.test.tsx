import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SettingsModal } from './settings-modal'
import { DEFAULT_SETTINGS, Settings } from '@/hooks/use-settings'

// Mock lucide-react
jest.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  Sun: () => <span data-testid="sun-icon">Sun</span>,
  Moon: () => <span data-testid="moon-icon">Moon</span>,
  Monitor: () => <span data-testid="monitor-icon">Monitor</span>,
  Grid3X3: () => <span data-testid="grid3x3-icon">Grid3X3</span>,
  LayoutGrid: () => <span data-testid="layoutgrid-icon">LayoutGrid</span>,
  Grid2X2: () => <span data-testid="grid2x2-icon">Grid2X2</span>,
  RotateCcw: () => <span data-testid="rotateccw-icon">RotateCcw</span>,
}))

// Mock the focus trap hook
jest.mock('@/hooks/use-focus-trap', () => ({
  useFocusTrap: () => ({
    containerRef: { current: null },
    activate: jest.fn(),
    deactivate: jest.fn(),
  }),
}))

describe('SettingsModal', () => {
  const mockSettings: Settings = { ...DEFAULT_SETTINGS }
  const mockOnClose = jest.fn()
  const mockUpdateSetting = jest.fn()
  const mockResetSettings = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(
      <SettingsModal
        isOpen={false}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Use heading role to get the Settings title specifically
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('should display theme options', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByLabelText('Light')).toBeInTheDocument()
    expect(screen.getByLabelText('Dark')).toBeInTheDocument()
    expect(screen.getByLabelText('System')).toBeInTheDocument()
  })

  it('should call updateSetting when theme is changed', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    fireEvent.click(screen.getByLabelText('Dark'))

    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'dark')
  })

  it('should display grid density options', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    expect(screen.getByText('Grid Density')).toBeInTheDocument()
    expect(screen.getByLabelText('Compact')).toBeInTheDocument()
    expect(screen.getByLabelText('Comfortable')).toBeInTheDocument()
    expect(screen.getByLabelText('Spacious')).toBeInTheDocument()
  })

  it('should call updateSetting when grid density is changed', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    fireEvent.click(screen.getByLabelText('Compact'))

    expect(mockUpdateSetting).toHaveBeenCalledWith('gridDensity', 'compact')
  })

  it('should call resetSettings when reset button is clicked', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    fireEvent.click(screen.getByText('Reset to Defaults'))

    expect(mockResetSettings).toHaveBeenCalled()
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should have proper ARIA attributes', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        settings={mockSettings}
        updateSetting={mockUpdateSetting}
        resetSettings={mockResetSettings}
        resolvedTheme="light"
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
  })
})
