import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { COUNTY_GROUPS, countyName } from "@shared/club-teams";
import { tick } from "./feel";
import { Body, Hairline, Icon, Label, Press } from "./ui";
import { color } from "./theme";

// A club's county, picked from the website's own fixed list
// (lib/elite/club-teams.ts COUNTIES): nobody types a place here. Closed, it
// is one row that says the county; tapped, it lists the three groups.
export function CountyPicker({ value, onChange }: { value: string | null; onChange: (county: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const pick = (id: string | null) => {
    tick();
    onChange(id);
    setOpen(false);
  };
  return (
    <View style={styles.box}>
      <Press onPress={() => setOpen((o) => !o)} style={styles.row} accessibilityLabel={`Your club's county: ${countyName(value) ?? "not set"}`} accessibilityState={{ expanded: open }}>
        <View style={{ flex: 1 }}>
          <Body dim size={12.5}>
            Your club&apos;s county
          </Body>
          <Label style={{ marginTop: 2 }}>{countyName(value) ?? "Pick a county"}</Label>
        </View>
        <View style={{ transform: [{ rotate: open ? "270deg" : "90deg" }] }}>
          <Icon name="chevron" size={18} stroke={color.faint} />
        </View>
      </Press>
      {open ? (
        <View>
          {value ? (
            <>
              <Hairline />
              <Press onPress={() => pick(null)} style={styles.option} accessibilityLabel="No county">
                <Label dim>No county</Label>
              </Press>
            </>
          ) : null}
          {COUNTY_GROUPS.map((g) => (
            <View key={g.state}>
              <Hairline />
              <Body dim size={12} style={styles.group}>
                {g.label}
              </Body>
              {g.counties.map((c) => (
                <Press key={c.id} onPress={() => pick(c.id)} style={styles.option} accessibilityLabel={c.name} accessibilityState={{ selected: c.id === value }}>
                  <Label style={{ flex: 1 }}>{c.name}</Label>
                  {c.id === value ? <Icon name="check" size={18} /> : null}
                </Press>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, backgroundColor: color.fill, borderWidth: 1, borderColor: color.line, overflow: "hidden" },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  group: { letterSpacing: 1.6, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 16 },
});
