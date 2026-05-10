import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/state/AuthContext";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { colors } from "./src/theme";
import { registerDeliveryLocationTask } from "./src/tracking/backgroundLocation";

export default function App() {
  registerDeliveryLocationTask();

  return (
    <AuthProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <RootNavigator />
    </AuthProvider>
  );
}
