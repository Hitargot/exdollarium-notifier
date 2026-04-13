import React, { useState, useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import ServicePickerModal from './ServicePickerModal';
import { useTheme } from '../theme/index';
import theme from '../styles/theme';

/**
 * Backwards-compatible thin wrapper around ServicePickerModal.
 * Now fully supports Dark Mode using the global theme.
 */
const ServiceSelector = ({ 
    selectedService, 
    onSelect 
}: { 
    selectedService?: string; 
    onSelect: (s: string) => void; 
}) => {
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState<string | null>(null);

    // Get the active theme
  const runtimeTheme = useTheme();
    const isDark = runtimeTheme.dark || runtimeTheme.mode === 'dark';

    // show a friendly label when available
    const displayText = label || selectedService || 'Select a service';

    return (
        <>
            <TouchableOpacity 
                style={[
                    styles.trigger, 
                    { 
                        backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                        borderColor: isDark ? '#334155' : '#E2E8F0'
                    }
                ]} 
                onPress={() => setOpen(true)}
            >
                <Text style={[styles.text, { color: runtimeTheme.colors.text }]}>
                    {displayText}
                </Text>
                <Text style={{ color: runtimeTheme.colors.primary, fontWeight: '700' }}>
                    Change
                </Text>
            </TouchableOpacity>

            <ServicePickerModal
                visible={open}
                onClose={() => setOpen(false)}
                selectedId={selectedService}
                onSelect={(s: any) => { 
                    if (typeof s === 'string') { 
                        onSelect(s); 
                    } else { 
                        onSelect(s._id); 
                        setLabel(s.label || s.name); 
                    }
                    setOpen(false); 
                }}
            />
        </>
    );
};

const styles = StyleSheet.create({
    trigger: { 
        padding: 14, 
        borderRadius: 12, 
        borderWidth: 1,
        justifyContent: 'space-between', 
        flexDirection: 'row', 
        alignItems: 'center',
        marginVertical: 8
    },
    text: { 
        fontSize: 16, 
        fontWeight: '600'
    }
});

export default ServiceSelector;