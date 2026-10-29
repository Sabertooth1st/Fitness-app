import { fireEvent, render, screen } from '@testing-library/react-native';
import { MuscleMap } from '../../src/components/MuscleMap';
import { Choice } from '../../src/components/ui';

jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));

describe('accessibility', () => {
  it('muscle map always provides written labels and a screen-reader summary', async () => {
    await render(<MuscleMap primary={['quadriceps', 'glutes']} secondary={['hamstrings']} />);
    expect(screen.getByText('Quadriceps (front of thigh), Glutes (buttocks)')).toBeTruthy();
    expect(screen.getByText('Hamstrings (back of thigh)')).toBeTruthy();
    expect(screen.getByLabelText(/Main muscles: Quadriceps.*Also working: Hamstrings/)).toBeTruthy();
    // It never claims measured activation.
    expect(screen.getByText(/does not measure activation or injury/)).toBeTruthy();
  });

  it('choices expose selection state and a text mark, not colour alone', async () => {
    const onPress = jest.fn();
    await render(<Choice label="Comfortable setting it up" selected onPress={onPress} />);
    const el = screen.getByRole('radio', { name: 'Comfortable setting it up' });
    expect(el.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('✓')).toBeTruthy();
    await fireEvent.press(el);
    expect(onPress).toHaveBeenCalled();
  });
});
