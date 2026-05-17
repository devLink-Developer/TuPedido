import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/state/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <RootNavigator />
    </AuthProvider>
  );
}
