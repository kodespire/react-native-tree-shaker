import { addDays, format } from 'date-fns';
import { StatusBar } from 'expo-status-bar';
import { debounce, groupBy } from 'lodash-es';
import { Camera, Heart } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

// Each import above goes through a package-level barrel that re-exports
// hundreds of modules. Only these few names are used.
const groups = groupBy(['apple', 'avocado', 'banana'], (word: string) => word[0]);
const log = debounce((value: string) => console.log(value), 100);

export default function App() {
  log('rendered');
  return (
    <View style={styles.container}>
      <Text>{format(addDays(new Date(2026, 0, 1), 7), 'yyyy-MM-dd')}</Text>
      <Text>{Object.keys(groups).join(', ')}</Text>
      <Camera color="black" />
      <Heart color="red" />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
