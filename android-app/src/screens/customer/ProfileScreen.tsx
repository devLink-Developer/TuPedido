import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../../components/AppButton";
import { Card } from "../../components/Card";
import { LeafletMapView } from "../../components/LeafletMapView";
import { Screen } from "../../components/Screen";
import { SectionHeader } from "../../components/SectionHeader";
import { StateMessage } from "../../components/StateMessage";
import { TextField } from "../../components/TextField";
import { createAddress, deleteAddress, fetchAddresses, geocodeAddress, lookupPostalCode, reverseGeocodeAddress, updateAddress } from "../../services/api";
import { MAP_INITIAL_REGION } from "../../config/env";
import { useAppFeedback } from "../../state/AppFeedbackContext";
import { useAuth } from "../../state/AuthContext";
import { colors, radii, spacing } from "../../theme";
import type { Address, AddressWrite, PostalCodeLookup } from "../../types/api";
import type { CustomerTabsParamList } from "../../navigation/types";
import { friendlyErrorMessage } from "../../utils/apiMessages";
import {
  buildAddressGeocodeRequest,
  buildStreetLine,
  emptyAddressForm,
  extractArgentinePostalCode,
  formatCoordinate,
  getAddressMissingFields,
  hasAddressGeolocation,
  normalizePostalCodeInput,
  splitStreetLine,
  toCoordinate,
  type AddressFormState
} from "../../utils/addressFields";

type Props = BottomTabScreenProps<CustomerTabsParamList, "Profile">;
type LookupLocality = PostalCodeLookup["localities"][number];

function getGeocodeKey(form: AddressFormState) {
  const request = buildAddressGeocodeRequest(form);
  return request
    ? [
        request.postal_code,
        request.province,
        request.locality,
        request.street_name,
        request.street_number
      ].join("|")
    : null;
}

export function ProfileScreen(_props: Props) {
  const { user, token, logout } = useAuth();
  const { showDialog, showError } = useAppFeedback();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressFormState>(emptyAddressForm);
  const [localities, setLocalities] = useState<LookupLocality[]>([]);
  const [localityDropdownOpen, setLocalityDropdownOpen] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const lastGeocodeKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setAddresses(await fetchAddresses(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const selectedLocality = useMemo(
    () => localities.find((item) => item.name === form.locality.trim()) ?? null,
    [form.locality, localities]
  );

  const fallbackCenter = {
    latitude: toCoordinate(form.latitude) ?? selectedLocality?.latitude ?? MAP_INITIAL_REGION.latitude,
    longitude: toCoordinate(form.longitude) ?? selectedLocality?.longitude ?? MAP_INITIAL_REGION.longitude
  };

  const geocodeRequest = buildAddressGeocodeRequest(form);
  const geocodeKey = getGeocodeKey(form);

  function updateForm(nextFields: Partial<AddressFormState>, clearCoordinates = false) {
    setForm((current) => ({
      ...current,
      ...nextFields,
      latitude: clearCoordinates ? "" : nextFields.latitude ?? current.latitude,
      longitude: clearCoordinates ? "" : nextFields.longitude ?? current.longitude
    }));
    if (clearCoordinates) {
      lastGeocodeKeyRef.current = null;
    }
  }

  function resetAddressForm() {
    setForm(emptyAddressForm);
    setLocalities([]);
    setLocalityDropdownOpen(false);
    setFeedback(null);
    setShowAddressForm(false);
    setEditingAddressId(null);
    lastGeocodeKeyRef.current = null;
  }

  function startAddressForm() {
    setForm({
      ...emptyAddressForm,
      is_default: addresses.length === 0
    });
    setLocalities([]);
    setLocalityDropdownOpen(false);
    setFeedback(null);
    setEditingAddressId(null);
    setShowAddressForm(true);
    lastGeocodeKeyRef.current = null;
  }

  function getFormFromAddress(address: Address): AddressFormState {
    const streetParts = splitStreetLine(address.street);
    return {
      label: address.label,
      postal_code: address.postal_code,
      province: address.province,
      locality: address.locality,
      street_name: streetParts.streetName,
      street_number: streetParts.streetNumber,
      details: address.details ?? "",
      latitude: formatCoordinate(address.latitude),
      longitude: formatCoordinate(address.longitude),
      is_default: address.is_default
    };
  }

  function editAddress(address: Address) {
    const nextForm = getFormFromAddress(address);
    setForm(nextForm);
    setLocalities([]);
    setLocalityDropdownOpen(false);
    setFeedback(null);
    setEditingAddressId(address.id);
    setShowAddressForm(true);
    lastGeocodeKeyRef.current = getGeocodeKey(nextForm);
  }

  async function handlePostalCodeLookup() {
    if (!token) return;
    const postalCode = extractArgentinePostalCode(form.postal_code);
    if (!postalCode) {
      setFeedback({ type: "error", text: "Ingresá un código postal argentino de 4 dígitos." });
      return;
    }

    setLookupLoading(true);
    setFeedback(null);
    try {
      const result = await lookupPostalCode(token, postalCode);
      setLocalities(result.localities);
      setLocalityDropdownOpen(Boolean(result.localities.length));
      updateForm({
        postal_code: result.postal_code,
        province: result.province,
        locality: "",
        street_name: "",
        street_number: ""
      }, true);
      setFeedback({
        type: "success",
        text: result.localities.length
          ? "Código postal validado. Elegí una localidad para continuar."
          : "Código postal validado, pero no encontramos localidades para seleccionar."
      });
    } catch (error) {
      setLocalities([]);
      setLocalityDropdownOpen(false);
      setFeedback({ type: "error", text: friendlyErrorMessage(error, "No pudimos validar el código postal.") });
    } finally {
      setLookupLoading(false);
    }
  }

  function handleLocalityChange(locality: LookupLocality) {
    setLocalityDropdownOpen(false);
    updateForm({
      locality: locality.name,
      street_name: "",
      street_number: "",
      latitude: formatCoordinate(locality.latitude),
      longitude: formatCoordinate(locality.longitude)
    });
    lastGeocodeKeyRef.current = null;
    setFeedback({
      type: "info",
      text: locality.latitude != null && locality.longitude != null
        ? "Localidad ubicada en el mapa. Completá calle y altura."
        : "Completá calle y altura para ubicar el punto exacto."
    });
  }

  async function reverseFillAddress(latitude: number, longitude: number, source: "map" | "current_location") {
    if (!token) return;
    try {
      const result = await reverseGeocodeAddress(token, { latitude, longitude });
      updateForm({
        street_name: result.street_name ?? form.street_name,
        street_number: result.street_number ?? form.street_number,
        latitude: formatCoordinate(latitude),
        longitude: formatCoordinate(longitude),
        details: form.details || result.display_name || ""
      });
      setFeedback({
        type: "success",
        text: result.street_name || result.display_name
          ? "Ubicación detectada. Revisá calle y altura antes de guardar."
          : "Pin actualizado en el mapa."
      });
    } catch {
      updateForm({ latitude: formatCoordinate(latitude), longitude: formatCoordinate(longitude) });
      setFeedback({
        type: "info",
        text: source === "current_location"
          ? "Tomamos tu ubicación. Revisá los datos antes de guardar."
          : "Pin actualizado. Completá calle y altura si falta."
      });
    }
  }

  async function handleGeocode(force = false) {
    if (!token) return null;
    const request = buildAddressGeocodeRequest(form);
    if (!request) {
      setFeedback({ type: "error", text: `Falta completar: ${getAddressMissingFields(form).join(", ")}.` });
      return null;
    }

    const key = [request.postal_code, request.province, request.locality, request.street_name, request.street_number].join("|");
    if (!force && lastGeocodeKeyRef.current === key && hasAddressGeolocation(form)) {
      return form;
    }

    setGeocoding(true);
    setFeedback(null);
    try {
      const result = await geocodeAddress(token, request);
      const nextForm = {
        ...form,
        latitude: formatCoordinate(result.latitude),
        longitude: formatCoordinate(result.longitude),
        details: form.details || result.display_name || ""
      };
      setForm(nextForm);
      lastGeocodeKeyRef.current = key;
      setFeedback({ type: "success", text: "Dirección ubicada en el mapa. Podés ajustar el pin si hace falta." });
      return nextForm;
    } catch (error) {
      setFeedback({ type: "error", text: friendlyErrorMessage(error, "No pudimos ubicar la dirección.") });
      return null;
    } finally {
      setGeocoding(false);
    }
  }

  useEffect(() => {
    if (!token || !geocodeKey || lastGeocodeKeyRef.current === geocodeKey) return;
    const timeout = setTimeout(() => {
      void handleGeocode(false);
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodeKey, token]);

  async function useCurrentLocation() {
    if (!token) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setFeedback({ type: "error", text: "Habilitá la ubicación para completar la dirección automáticamente." });
        return;
      }

      if (Platform.OS === "android") {
        await Location.enableNetworkProviderAsync().catch(() => undefined);
      }
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 300000 }).catch(() => null);
      const position = lastKnown ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await reverseFillAddress(position.coords.latitude, position.coords.longitude, "current_location");
    } catch (error) {
      setFeedback({ type: "error", text: friendlyErrorMessage(error, "No pudimos obtener tu ubicación.") });
    } finally {
      setLocating(false);
    }
  }

  async function saveAddress() {
    if (!token) return;
    let nextForm = form;
    if (!hasAddressGeolocation(nextForm)) {
      const geocoded = await handleGeocode(true);
      if (!geocoded) return;
      nextForm = geocoded;
    }

    const latitude = toCoordinate(nextForm.latitude);
    const longitude = toCoordinate(nextForm.longitude);
    if (latitude === null || longitude === null) {
      setFeedback({ type: "error", text: "Falta confirmar el pin en el mapa." });
      return;
    }

    const missing = getAddressMissingFields(nextForm);
    if (missing.length) {
      setFeedback({ type: "error", text: `Falta completar: ${missing.join(", ")}.` });
      return;
    }

    const payload: AddressWrite = {
      label: nextForm.label.trim() || "Casa",
      postal_code: extractArgentinePostalCode(nextForm.postal_code),
      province: nextForm.province.trim(),
      locality: nextForm.locality.trim(),
      street: buildStreetLine(nextForm.street_name, nextForm.street_number),
      details: nextForm.details.trim(),
      latitude,
      longitude,
      is_default: addresses.length <= 1 || nextForm.is_default
    };

    try {
      if (editingAddressId !== null) {
        await updateAddress(token, editingAddressId, payload);
      } else {
        await createAddress(token, payload);
      }
      resetAddressForm();
      await load();
    } catch (error) {
      setFeedback({ type: "error", text: friendlyErrorMessage(error, "No pudimos guardar la dirección.") });
    }
  }

  async function deleteCurrentAddress(addressId: number) {
    if (!token) return;
    try {
      await deleteAddress(token, addressId);
      if (editingAddressId === addressId) {
        resetAddressForm();
      }
      await load();
    } catch (error) {
      showError("No pudimos eliminarla", friendlyErrorMessage(error));
    }
  }

  function removeAddress(addressId: number) {
    showDialog({
      title: "Eliminar dirección",
      message: "Esta dirección se va a quitar de tu perfil.",
      variant: "warning",
      actions: [
        { label: "Cancelar", variant: "ghost" },
        { label: "Eliminar", variant: "danger", onPress: () => void deleteCurrentAddress(addressId) }
      ]
    });
  }

  const mapMarkerLatitude = toCoordinate(form.latitude);
  const mapMarkerLongitude = toCoordinate(form.longitude);

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <SectionHeader size="large" title="Perfil" description={user?.email ?? "Tu cuenta"} />
      <Card style={styles.accountCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <View style={styles.accountCopy}>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.meta}>Cuenta cliente</Text>
        </View>
        <AppButton title="Salir" icon="log-out-outline" onPress={() => void logout()} variant="ghost" />
      </Card>

      <View style={styles.sectionTitleRow}>
        <SectionHeader size="compact" title="Direcciones" description="Guardá una dirección con pin para envío." />
        {!showAddressForm ? <AppButton title="Agregar" icon="add-outline" onPress={startAddressForm} /> : null}
      </View>

      {addresses.length ? (
        addresses.map((address) => (
          <Card key={address.id} style={[styles.address, editingAddressId === address.id ? styles.addressEditing : null]}>
            <View style={styles.addressIcon}>
              <Ionicons name={address.is_default ? "home" : "location-outline"} size={21} color={colors.primary} />
            </View>
            <View style={styles.addressMain}>
              <Text style={styles.addressTitle}>{address.label}{address.is_default ? " · Predeterminada" : ""}</Text>
              <Text style={styles.meta}>{address.street}</Text>
              <Text style={styles.meta}>{[address.locality, address.province, address.postal_code].filter(Boolean).join(" - ")}</Text>
              <Text style={[styles.pinStatus, address.latitude != null && address.longitude != null ? styles.pinOk : styles.pinMissing]}>
                {address.latitude != null && address.longitude != null ? "Con pin de mapa" : "Falta pin de mapa"}
              </Text>
            </View>
            <View style={styles.addressActions}>
              <AppButton title="Editar" icon="create-outline" onPress={() => editAddress(address)} variant="ghost" />
              <AppButton title="Eliminar" icon="trash-outline" onPress={() => removeAddress(address.id)} variant="danger" />
            </View>
          </Card>
        ))
      ) : !showAddressForm ? (
        <StateMessage title="Sin direcciones guardadas" description="Agregá una dirección para pedir con envío." actionLabel="Agregar dirección" onAction={startAddressForm} />
      ) : null}

      {showAddressForm ? (
        <Card style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={styles.formHeaderCopy}>
              <Text style={styles.name}>{editingAddressId === null ? "Nueva dirección" : "Editar dirección"}</Text>
              <Text style={styles.meta}>Buscá el CP, elegí localidad y confirmá el pin en el mapa.</Text>
            </View>
            <AppButton title="Cerrar" icon="close-outline" onPress={resetAddressForm} variant="ghost" />
          </View>

          <TextField label="Etiqueta" leftIcon="bookmark-outline" value={form.label} onChangeText={(value) => updateForm({ label: value })} placeholder="Casa, trabajo" />
          <View style={styles.lookupRow}>
            <View style={styles.lookupInput}>
              <TextField
                label="Código postal"
                leftIcon="mail-open-outline"
                value={form.postal_code}
                onChangeText={(value) => {
                  setLocalities([]);
                  setLocalityDropdownOpen(false);
                  setFeedback(null);
                  updateForm({
                    postal_code: normalizePostalCodeInput(value),
                    province: "",
                    locality: "",
                    street_name: "",
                    street_number: ""
                  }, true);
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <AppButton title="Buscar CP" icon="search-outline" onPress={() => void handlePostalCodeLookup()} loading={lookupLoading} />
          </View>

          <TextField label="Provincia" leftIcon="map-outline" value={form.province} editable={false} placeholder="Se completa al buscar CP" />

          <View style={styles.localitiesBlock}>
            <Text style={styles.fieldLabel}>Localidad</Text>
            {localities.length ? (
              <View style={styles.localityDropdown}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: localityDropdownOpen }}
                  onPress={() => setLocalityDropdownOpen((current) => !current)}
                  style={({ pressed }) => [styles.localitySelect, pressed && styles.pressed]}
                >
                  <View style={styles.localitySelectCopy}>
                    <Text style={[styles.localitySelectText, !form.locality && styles.localityPlaceholder]} numberOfLines={1}>
                      {form.locality || "Elegí una localidad"}
                    </Text>
                    <Text style={styles.localitySelectHint} numberOfLines={1}>
                      {form.locality ? "Tocá para cambiar" : `${localities.length} localidades disponibles`}
                    </Text>
                  </View>
                  <Ionicons name={localityDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.mutedText} />
                </Pressable>

                {localityDropdownOpen ? (
                  <View style={styles.localityMenu}>
                    {localities.map((locality) => {
                      const active = locality.name === form.locality;
                      return (
                        <Pressable
                          key={locality.name}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => handleLocalityChange(locality)}
                          style={({ pressed }) => [styles.localityOption, active && styles.localityOptionActive, pressed && styles.pressed]}
                        >
                          <Text style={[styles.localityOptionText, active && styles.localityOptionTextActive]}>{locality.name}</Text>
                          {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : form.locality ? (
              <View style={styles.localityReadonly}>
                <View style={styles.localityReadonlyIcon}>
                  <Ionicons name="business-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.localityReadonlyCopy}>
                  <Text style={styles.localitySelectText} numberOfLines={1}>{form.locality}</Text>
                  <Text style={styles.localitySelectHint} numberOfLines={1}>Buscá otro CP para cambiarla</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.helperText}>Primero buscá un código postal para ver localidades.</Text>
            )}
          </View>

          <View style={styles.streetRow}>
            <View style={styles.streetName}>
              <TextField label="Calle" leftIcon="home-outline" value={form.street_name} onChangeText={(value) => updateForm({ street_name: value }, true)} editable={Boolean(form.locality)} placeholder="Av. Siempre Viva" />
            </View>
            <View style={styles.streetNumber}>
              <TextField label="Altura" value={form.street_number} onChangeText={(value) => updateForm({ street_number: value }, true)} onBlur={() => void handleGeocode(true)} editable={Boolean(form.locality)} keyboardType="number-pad" placeholder="123" />
            </View>
          </View>

          <TextField label="Indicaciones para el repartidor" leftIcon="reader-outline" value={form.details} onChangeText={(value) => updateForm({ details: value })} placeholder="Piso, depto, referencias" multiline />

          <View style={styles.mapHeader}>
            <View style={styles.mapHeaderCopy}>
              <Text style={styles.fieldLabel}>Ubicación en mapa</Text>
              <Text style={styles.helperText}>Tocá el mapa para mover el pin o usá tu ubicación actual.</Text>
            </View>
            <AppButton title="Mi ubicación" icon="navigate-outline" onPress={() => void useCurrentLocation()} loading={locating} variant="ghost" />
          </View>

          <LeafletMapView
            height={260}
            interactive
            center={fallbackCenter}
            markers={[
              {
                id: "address",
                label: "Dirección",
                latitude: mapMarkerLatitude,
                longitude: mapMarkerLongitude,
                color: colors.primary,
                draggable: true
              }
            ]}
            onCoordinateChange={(coordinate) => void reverseFillAddress(coordinate.latitude, coordinate.longitude, "map")}
          />

          <View style={[styles.locationStatus, hasAddressGeolocation(form) ? styles.locationReady : null]}>
            <Ionicons name={hasAddressGeolocation(form) ? "checkmark-circle" : "navigate-outline"} size={20} color={hasAddressGeolocation(form) ? colors.success : colors.mutedText} />
            <Text style={[styles.locationStatusText, hasAddressGeolocation(form) ? styles.locationReadyText : null]}>
              {hasAddressGeolocation(form) ? "Pin confirmado para envío" : "Todavía falta confirmar el pin"}
            </Text>
          </View>

          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.is_default }} onPress={() => updateForm({ is_default: !form.is_default })} style={({ pressed }) => [styles.defaultRow, pressed && styles.pressed]}>
            <Ionicons name={form.is_default ? "checkbox" : "square-outline"} size={22} color={colors.primary} />
            <Text style={styles.defaultText}>Usar como dirección predeterminada</Text>
          </Pressable>

          {feedback ? <Text style={[styles.feedback, styles[`${feedback.type}Feedback`]]}>{feedback.text}</Text> : null}
          {geocoding ? <Text style={styles.helperText}>Ubicando dirección...</Text> : null}
          <AppButton title={editingAddressId === null ? "Guardar dirección" : "Actualizar dirección"} icon="save-outline" onPress={() => void saveAddress()} loading={geocoding || locating || lookupLoading} fullWidth />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  accountCopy: {
    flex: 1,
    minWidth: 0
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  meta: {
    color: colors.mutedText,
    lineHeight: 20
  },
  sectionTitleRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  address: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radii.lg
  },
  addressEditing: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  addressIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  addressMain: {
    flex: 1,
    minWidth: 0
  },
  addressTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  pinStatus: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: radii.pill,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900"
  },
  pinOk: {
    color: colors.success,
    backgroundColor: colors.successSoft
  },
  pinMissing: {
    color: colors.warning,
    backgroundColor: colors.warningSoft
  },
  addressActions: {
    width: 112,
    gap: spacing.xs
  },
  formCard: {
    gap: spacing.md,
    marginTop: spacing.sm
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md
  },
  formHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  lookupRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm
  },
  lookupInput: {
    flex: 1,
    minWidth: 0
  },
  localitiesBlock: {
    gap: spacing.sm
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  localityDropdown: {
    gap: spacing.sm
  },
  localitySelect: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  localitySelectCopy: {
    flex: 1,
    minWidth: 0
  },
  localitySelectText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  localityPlaceholder: {
    color: colors.subtleText
  },
  localitySelectHint: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  localityReadonly: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  localityReadonlyIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center"
  },
  localityReadonlyCopy: {
    flex: 1,
    minWidth: 0
  },
  localityMenu: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden"
  },
  localityOption: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  localityOptionActive: {
    backgroundColor: colors.primarySoft
  },
  localityOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  localityOptionTextActive: {
    color: colors.primaryDark
  },
  streetRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  streetName: {
    flex: 1,
    minWidth: 0
  },
  streetNumber: {
    width: 112
  },
  mapHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  mapHeaderCopy: {
    flex: 1,
    minWidth: 0
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18
  },
  locationStatus: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  locationReady: {
    borderColor: "#BBF7D0",
    backgroundColor: colors.successSoft
  },
  locationStatusText: {
    flex: 1,
    color: colors.mutedText,
    fontWeight: "800"
  },
  locationReadyText: {
    color: colors.success
  },
  defaultRow: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  defaultText: {
    flex: 1,
    color: colors.text,
    fontWeight: "800"
  },
  feedback: {
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  successFeedback: {
    color: colors.success,
    backgroundColor: colors.successSoft
  },
  errorFeedback: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft
  },
  infoFeedback: {
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft
  },
  pressed: {
    opacity: 0.78
  }
});
