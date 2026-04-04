import { createContext, useContext, useMemo, useState, type Dispatch, type PropsWithChildren, type ReactNode, type SetStateAction } from "react";

type MerchantMobileHeaderContextValue = {
  mobileHeaderAction: ReactNode | null;
  setMobileHeaderAction: Dispatch<SetStateAction<ReactNode | null>>;
};

const noopSetMobileHeaderAction: Dispatch<SetStateAction<ReactNode | null>> = () => undefined;

const fallbackContextValue: MerchantMobileHeaderContextValue = {
  mobileHeaderAction: null,
  setMobileHeaderAction: noopSetMobileHeaderAction
};

const MerchantMobileHeaderContext = createContext<MerchantMobileHeaderContextValue | null>(null);

export function MerchantMobileHeaderProvider({ children }: PropsWithChildren) {
  const [mobileHeaderAction, setMobileHeaderAction] = useState<ReactNode | null>(null);
  const value = useMemo(
    () => ({
      mobileHeaderAction,
      setMobileHeaderAction
    }),
    [mobileHeaderAction]
  );

  return <MerchantMobileHeaderContext.Provider value={value}>{children}</MerchantMobileHeaderContext.Provider>;
}

export function useMerchantMobileHeader() {
  return useContext(MerchantMobileHeaderContext) ?? fallbackContextValue;
}
