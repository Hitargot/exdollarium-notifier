import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreferences } from '../contexts/PreferencesContext';

const NotificationSettingsScreen = () => {
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [smsNotifications, setSmsNotifications] = useState(false);
    const [pushNotifications, setPushNotifications] = useState(false);
    const [showSparkline, setShowSparkline] = useState(true);
    const prefCtx = (() => {
        try { return usePreferences(); } catch (e) { return undefined as any; }
    })();

    const handleSavePreferences = async () => {
        // Here you would send these preferences to your backend
        // For now, just log them to the console
        console.log('Notification Preferences:', { emailNotifications, smsNotifications, pushNotifications });
        // persist sparkline preference too
        try {
            if (prefCtx && prefCtx.ready) {
                await prefCtx.setShowBalanceSparkline(showSparkline);
            } else {
                await AsyncStorage.setItem('showBalanceSparkline', JSON.stringify(showSparkline));
            }
        } catch (e) { /* ignore */ }
        Alert.alert('Success', 'Your notification preferences have been updated!');
    };

    useEffect(() => {
        if (prefCtx && prefCtx.ready) {
            setShowSparkline(prefCtx.preferences.showBalanceSparkline);
            return;
        }
        (async () => {
            try {
                const v = await AsyncStorage.getItem('showBalanceSparkline');
                if (v !== null) setShowSparkline(JSON.parse(v));
            } catch (e) { /* ignore */ }
        })();
    }, [prefCtx]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Manage Notifications</Text>

            <View style={styles.preference}>
                <Text>Email Notifications</Text>
                <Switch value={emailNotifications} onValueChange={setEmailNotifications} />
            </View>

            <View style={styles.preference}>
                <Text>SMS Notifications</Text>
                <Switch value={smsNotifications} onValueChange={setSmsNotifications} />
            </View>

            <View style={styles.preference}>
                <Text>Push Notifications</Text>
                <Switch value={pushNotifications} onValueChange={setPushNotifications} />
            </View>

            <View style={styles.preference}>
                <Text>Show balance sparkline on dashboard</Text>
                <Switch value={showSparkline} onValueChange={async (v) => {
                    setShowSparkline(v);
                    try {
                        if (prefCtx && prefCtx.ready) {
                            await prefCtx.setShowBalanceSparkline(v);
                        } else {
                            await AsyncStorage.setItem('showBalanceSparkline', JSON.stringify(v));
                        }
                    } catch (e) { /* ignore */ }
                }} />
            </View>

            <Button title="Save Preferences" onPress={handleSavePreferences} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    preference: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
});

export default NotificationSettingsScreen;
