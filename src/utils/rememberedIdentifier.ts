import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'rememberedIdentifier';

export async function getRememberedIdentifier(): Promise<string | null> {
    try {
        const v = await AsyncStorage.getItem(KEY);
        return v;
    } catch (e) {
        // swallow errors but return null so callers behave consistently
        return null;
    }
}

export async function setRememberedIdentifier(id: string): Promise<void> {
    try {
        if (!id) return;
        await AsyncStorage.setItem(KEY, id.trim());
    } catch (e) {
        // ignore
    }
}

export async function removeRememberedIdentifier(): Promise<void> {
    try {
        await AsyncStorage.removeItem(KEY);
    } catch (e) {
        // ignore
    }
}

export default { getRememberedIdentifier, setRememberedIdentifier, removeRememberedIdentifier };
