import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useRouter,
} from 'expo-router';

import {
  getDashboardSummary,
} from '../src/services/dashboardService';

import {
  getDebtFreeTarget,
  saveDebtFreeTarget,
} from '../src/services/debtFreeTargetService';

import {
  calculateTargetPerformance,
} from '../src/engine/targetPerformance';


export default function DebtFreeTargetScreen() {

  const router =
    useRouter();


  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [dashboardSummary, setDashboardSummary] =
    useState<any>(null);


  const [targetDate, setTargetDate] =
    useState('');

  const [
    additionalPayment,
    setAdditionalPayment,
  ] = useState('0');


  const [
    outstanding,
    setOutstanding,
  ] = useState(0);


  // IMPORTANT: keep the original target baseline when editing.
  // The baseline must not be reset to today's outstanding amount.
  const [
    baselineOutstanding,
    setBaselineOutstanding,
  ] = useState(0);

  const [
    baselineDate,
    setBaselineDate,
  ] = useState('');


  const [
    monthlyEMI,
    setMonthlyEMI,
  ] = useState(0);


  const [
    projectedDate,
    setProjectedDate,
  ] = useState<Date | null>(
    null
  );


  const [
    status,
    setStatus,
  ] = useState<
    'AHEAD' |
    'ON_TRACK' |
    'BEHIND' |
    null
  >(null);


  /*
   * --------------------------------------------------
   * LOAD
   * --------------------------------------------------
   */

  useEffect(() => {

    loadData();

  }, []);


  async function loadData() {

    try {

      const [
        summary,
        existingTarget,
      ] =
        await Promise.all([
          getDashboardSummary(),
          getDebtFreeTarget(),
        ]);


      setDashboardSummary(summary);

      const currentOutstanding =
        Number(
          summary.totalOutstanding
        ) || 0;


      const currentEMI =
        Number(
          summary.totalMonthlyEMI
        ) || 0;


      setOutstanding(
        currentOutstanding
      );

      setBaselineOutstanding(
        currentOutstanding
      );

      setBaselineDate(
        formatDateInput(new Date())
      );

      setMonthlyEMI(
        currentEMI
      );


      if (
        existingTarget
      ) {

        setTargetDate(
          existingTarget.targetDate
        );

        // Preserve the original baseline saved when the target was created.
        // Editing the target date/payment must NOT restart the measurement period.
        const savedBaselineOutstanding =
          Number(
            existingTarget.baselineOutstanding
          );

        const savedBaselineDate =
          String(
            existingTarget.baselineDate || ''
          );

        if (
          Number.isFinite(savedBaselineOutstanding) &&
          savedBaselineOutstanding > 0
        ) {
          setBaselineOutstanding(
            savedBaselineOutstanding
          );
        }

        if (savedBaselineDate) {
          setBaselineDate(
            savedBaselineDate
          );
        }

        setAdditionalPayment(
          String(
            existingTarget
              .additionalMonthlyPayment ??
              0
          )
        );

      } else {

        /*
         * Default target:
         * 5 years from today.
         */
        const date =
          new Date();

        date.setFullYear(
          date.getFullYear() +
            5
        );

        setTargetDate(
          formatDateInput(
            date
          )
        );

      }

    } catch (error) {

      console.error(
        'Debt-free target loading failed:',
        error
      );

    } finally {

      setLoading(false);

    }
  }


  useEffect(() => {
    if (!dashboardSummary || !targetDate) return;

    const extra = Math.max(0, Number(additionalPayment) || 0);

    calculatePreview(
      dashboardSummary,
      targetDate,
      extra,
      baselineOutstanding,
      baselineDate
    );
  }, [
    dashboardSummary,
    targetDate,
    additionalPayment,
    baselineOutstanding,
    baselineDate,
  ]);


  /*
   * --------------------------------------------------
   * PREVIEW
   * --------------------------------------------------
   */

  async function calculatePreview(
    summary: any,
    dateValue: string,
    extra: number,
    previewBaselineOutstanding: number = baselineOutstanding,
    previewBaselineDate: string = baselineDate
  ) {

    if (
      !dateValue
    ) {
      return;
    }


    const target =
      new Date(
        dateValue
      );


    if (
      Number.isNaN(
        target.getTime()
      )
    ) {
      return;
    }


    const previewBaseline =
      Number(previewBaselineOutstanding) > 0
        ? Number(previewBaselineOutstanding)
        : Number(summary.totalOutstanding) || 0;

    const previewBaselineDateValue =
      new Date(
        previewBaselineDate || formatDateInput(new Date())
      );


    const performance =
      calculateTargetPerformance(
        summary.loans.map(
          (item: any) =>
            item.loan
        ),

        previewBaseline,

        previewBaselineDateValue,

        target,

        extra
      );


    setProjectedDate(
      performance
        .projectedDebtFreeDate
    );

    setStatus(
      performance.status
    );
  }


  /*
   * --------------------------------------------------
   * SAVE
   * --------------------------------------------------
   */

  async function handleSave() {

    const target =
      new Date(
        targetDate
      );


    if (
      Number.isNaN(
        target.getTime()
      )
    ) {

      alert(
        'Please enter a valid target date.'
      );

      return;
    }


    if (
      target <=
      new Date()
    ) {

      alert(
        'Target date must be in the future.'
      );

      return;
    }


    if (
      outstanding <=
      0
    ) {

      alert(
        'There is no outstanding loan balance.'
      );

      return;
    }


    const extra =
      Math.max(
        0,
        Number(
          additionalPayment
        ) || 0
      );


    try {

      setSaving(true);


      await saveDebtFreeTarget({

        targetDate:
          formatDateInput(
            target
          ),

        // Never reset the original baseline while editing.
        baselineOutstanding:
          baselineOutstanding > 0
            ? baselineOutstanding
            : outstanding,

        baselineDate:
          baselineDate ||
          formatDateInput(new Date()),

        additionalMonthlyPayment:
          extra,
      });


      alert(
        'Debt-free target saved successfully.'
      );


      router.replace('/');

    } catch (error) {

      console.error(
        'Saving debt-free target failed:',
        error
      );


      alert(
        error instanceof Error
          ? error.message
          : 'Unable to save debt-free target.'
      );

    } finally {

      setSaving(false);

    }
  }


  /*
   * --------------------------------------------------
   * LOADING
   * --------------------------------------------------
   */

  /* --------------------------------------------------
   * PREMIUM UI
   * -------------------------------------------------- */
  if (loading) {
    return (
        <View style={styles.loading}>
          <View style={styles.loadingOrb}>
            <Text style={styles.loadingOrbText}>◷</Text>
          </View>
          <Text style={styles.loadingTitle}>Preparing your target</Text>
          <Text style={styles.loadingText}>Loading your current loan position…</Text>
        </View>
    );
  }

  const extra = Math.max(0, Number(additionalPayment) || 0);
  const totalPlanned = monthlyEMI + extra;
  const targetDateObj = targetDate ? new Date(targetDate) : null;
  const validTargetDate = !!targetDateObj && !Number.isNaN(targetDateObj.getTime());

  return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* PAGE HEADER */}
        <View style={styles.pageHeader}>
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>FINANCIAL GOAL</Text>
            </View>
            <Text style={styles.title}>Debt-free target</Text>
            <Text style={styles.subtitle}>
              Set your destination, see the projected payoff date, and adjust your monthly contribution.
            </Text>
          </View>
          <Pressable
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
        </View>

        {/* CURRENT POSITION */}
        <View style={styles.positionGrid}>
          <View style={[styles.metricCard, styles.metricBlue]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>CURRENT OUTSTANDING</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>₹</Text></View>
            </View>
            <Text style={styles.metricValueLight}>{formatCurrency(outstanding)}</Text>
            <Text style={styles.metricCaptionLight}>Balance captured for this target</Text>
          </View>

          <View style={[styles.metricCard, styles.metricGreen]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>MONTHLY COMMITMENT</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>↗</Text></View>
            </View>
            <Text style={styles.metricValueLight}>{formatCurrency(monthlyEMI)}</Text>
            <Text style={styles.metricCaptionLight}>Regular loan repayment</Text>
          </View>

          <View style={[styles.metricCard, styles.metricPurple]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>TARGET DATE</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>◷</Text></View>
            </View>
            <Text style={styles.metricValueLightSmall}>
              {validTargetDate ? formatDate(targetDateObj as Date) : '—'}
            </Text>
            <Text style={styles.metricCaptionLight}>Your desired debt-free date</Text>
          </View>

          <View style={[styles.metricCard, styles.metricOrange]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>EXTRA MONTHLY</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>+</Text></View>
            </View>
            <Text style={styles.metricValueLight}>{formatCurrency(extra)}</Text>
            <Text style={styles.metricCaptionLight}>Additional payment toward principal</Text>
          </View>
        </View>

        {/* CONFIGURATION */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>TARGET PLAN</Text>
            <Text style={styles.sectionTitle}>Configure your journey</Text>
          </View>
          <Text style={styles.sectionHint}>Changes are saved only when you press Save</Text>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.formCard}>
            <View style={styles.cardIconBlue}>
              <Text style={styles.cardIconTextBlue}>◷</Text>
            </View>
            <Text style={styles.cardTitle}>Debt-free date</Text>
            <Text style={styles.helpText}>
              Choose the date by which you want your outstanding loans to be cleared.
            </Text>
            <Text style={styles.inputLabel}>TARGET DATE</Text>
            <TextInput
              value={targetDate}
              onChangeText={(value) => setTargetDate(value)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9AA6B8"
              keyboardType="numbers-and-punctuation"
              style={styles.input}
              maxLength={10}
            />
            <Text style={styles.inputHint}>Example: 2030-12-31</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.cardIconOrange}>
              <Text style={styles.cardIconTextOrange}>+</Text>
            </View>
            <Text style={styles.cardTitle}>Additional monthly payment</Text>
            <Text style={styles.helpText}>
              Add an amount above your regular commitment to accelerate principal reduction.
            </Text>
            <Text style={styles.inputLabel}>EXTRA EACH MONTH</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                value={additionalPayment}
                onChangeText={(value) => setAdditionalPayment(value)}
                keyboardType="numeric"
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor="#9AA6B8"
              />
            </View>
            <View style={styles.plannedRow}>
              <Text style={styles.plannedLabel}>Total planned monthly</Text>
              <Text style={styles.plannedValue}>{formatCurrency(totalPlanned)}</Text>
            </View>
          </View>
        </View>

        {/* PROJECTION */}
        <View style={styles.projectionCard}>
          <View style={styles.projectionHeader}>
            <View>
              <Text style={styles.projectionEyebrow}>PROJECTION</Text>
              <Text style={styles.projectionTitle}>Your debt-free outlook</Text>
              <Text style={styles.projectionSubtitle}>
                Based on the current target baseline and your planned monthly contribution.
              </Text>
            </View>
            {projectedDate && (
              <View style={[
                styles.statusPill,
                status === 'AHEAD' ? styles.statusAhead : status === 'ON_TRACK' ? styles.statusTrack : styles.statusBehind,
              ]}>
                <Text style={styles.statusPillText}>
                  {status === 'AHEAD' ? '↗ Ahead of target' : status === 'ON_TRACK' ? '✓ On track' : '! Needs attention'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.projectionBody}>
            <View style={styles.projectionDateBlock}>
              <Text style={styles.projectionLabel}>PROJECTED DEBT-FREE DATE</Text>
              <Text style={styles.projectionDate}>
                {projectedDate ? formatDate(projectedDate) : '—'}
              </Text>
              <Text style={styles.projectionMeta}>
                {projectedDate && validTargetDate
                  ? projectedDate <= (targetDateObj as Date)
                    ? 'Your current plan reaches the goal on or before the target date.'
                    : 'Your current plan needs a higher monthly contribution to meet the target.'
                  : 'Enter a valid future target date to calculate the projection.'}
              </Text>
            </View>

            <View style={styles.progressPanel}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressLabel}>Target status</Text>
                <Text style={styles.progressStatus}>
                  {status === 'AHEAD' ? 'AHEAD' : status === 'ON_TRACK' ? 'ON TRACK' : status === 'BEHIND' ? 'BEHIND' : '—'}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  status === 'AHEAD' ? styles.progressGreen : status === 'ON_TRACK' ? styles.progressBlue : styles.progressOrange,
                  { width: status === 'AHEAD' ? '100%' : status === 'ON_TRACK' ? '78%' : '42%' },
                ]} />
              </View>
              <View style={styles.progressFootRow}>
                <Text style={styles.progressFootText}>Baseline {formatCurrency(baselineOutstanding)}</Text>
                <Text style={styles.progressFootText}>{formatDate(new Date(baselineDate))}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ACTION */}
        <View style={styles.actionRow}>
          <Text style={styles.disclaimer}>
            Your saved baseline is preserved when editing this target. This keeps your progress measurement consistent.
          </Text>
          <Pressable
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              saving && styles.saveButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save debt-free target</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
  );
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value: number): string {
  return `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFD83D',
  },

  content: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 56,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD83D',
    padding: 30,
  },

  loadingOrb: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F4C400',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D5AA00',
  },

  loadingOrbText: {
    fontSize: 28,
    color: '#171A24',
    fontWeight: '800',
  },

  loadingTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '800',
    color: '#171A24',
  },

  loadingText: {
    marginTop: 7,
    fontSize: 13,
    color: '#5A4918',
  },

  pageHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 20,
  },

  headerCopy: {
    flex: 1,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#171A24',
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#4D3B00',
  },

  title: {
    fontSize: 37,
    fontWeight: '800',
    color: '#171A24',
    letterSpacing: -0.6,
  },

  subtitle: {
    marginTop: 6,
    maxWidth: 900,
    fontSize: 15,
    lineHeight: 20,
    color: '#4D5566',
  },

  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#171A24',
    borderWidth: 1,
    borderColor: '#171A24',
  },

  backButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFD83D',
  },

  pressed: {
    opacity: 0.78,
  },

  positionGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 28,
  },

  metricCard: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: 145,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  metricBlue: {
    backgroundColor: '#F4C400',
    borderColor: '#D5AA00',
    shadowColor: '#9A7600',
  },

  metricGreen: {
    backgroundColor: '#E7F2A8',
    borderColor: '#BFD66A',
    shadowColor: '#6D7C22',
  },

  metricPurple: {
    backgroundColor: '#FFC83D',
    borderColor: '#D9A600',
    shadowColor: '#9A7000',
  },

  metricOrange: {
    backgroundColor: '#FFB84A',
    borderColor: '#E39424',
    shadowColor: '#A96312',
  },

  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metricLabelLight: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#4D3B00',
  },

  metricIconLight: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(23,26,36,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricIconText: {
    color: '#171A24',
    fontSize: 17,
    fontWeight: '800',
  },

  metricValueLight: {
    marginTop: 17,
    fontSize: 32,
    fontWeight: '800',
    color: '#171A24',
    letterSpacing: -0.5,
  },

  metricValueLightSmall: {
    marginTop: 18,
    fontSize: 24,
    fontWeight: '800',
    color: '#171A24',
  },

  metricCaptionLight: {
    marginTop: 5,
    fontSize: 12,
    color: '#5A4918',
  },

  sectionHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 20,
  },

  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#7A5B00',
  },

  sectionTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '800',
    color: '#171A24',
  },

  sectionHint: {
    fontSize: 12,
    color: '#6B5A1A',
  },

  formGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },

  formCard: {
    flexGrow: 1,
    flexBasis: 420,
    padding: 22,
    backgroundColor: '#FFF0A8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E7C33A',
    shadowColor: '#171A24',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },

  cardIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4C400',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  cardIconOrange: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFB84A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  cardIconTextBlue: {
    color: '#171A24',
    fontSize: 20,
    fontWeight: '800',
  },

  cardIconTextOrange: {
    color: '#171A24',
    fontSize: 21,
    fontWeight: '800',
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#171A24',
  },

  helpText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#5A4918',
  },

  inputLabel: {
    marginTop: 19,
    marginBottom: 7,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#6B5A1A',
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#D5AA00',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    color: '#171A24',
    backgroundColor: '#FFF9D6',
  },

  inputHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#7D6B2B',
  },

  amountInputRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5AA00',
    borderRadius: 12,
    backgroundColor: '#FFF9D6',
  },

  currencyPrefix: {
    paddingLeft: 15,
    fontSize: 21,
    fontWeight: '800',
    color: '#7A5B00',
  },

  amountInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 10,
    fontSize: 19,
    color: '#171A24',
  },

  plannedRow: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#E7C33A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  plannedLabel: {
    fontSize: 13,
    color: '#5A4918',
  },

  plannedValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#159A68',
  },

  projectionCard: {
    width: '100%',
    marginTop: 22,
    padding: 24,
    borderRadius: 22,
    backgroundColor: '#171A24',
    borderWidth: 1,
    borderColor: '#171A24',
    shadowColor: '#171A24',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 5,
  },

  projectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 18,
  },

  projectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#FFD83D',
  },

  projectionTitle: {
    marginTop: 5,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFD83D',
  },

  projectionSubtitle: {
    marginTop: 5,
    maxWidth: 850,
    fontSize: 13,
    lineHeight: 18,
    color: '#E7DFA8',
  },

  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },

  statusAhead: {
    backgroundColor: '#DDF7EC',
  },

  statusTrack: {
    backgroundColor: '#FFF0A8',
  },

  statusBehind: {
    backgroundColor: '#FCE4E4',
  },

  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#24304A',
  },

  projectionBody: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    alignItems: 'stretch',
  },

  projectionDateBlock: {
    flex: 1,
    minWidth: 280,
  },

  projectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#BDB58A',
  },

  projectionDate: {
    marginTop: 8,
    fontSize: 37,
    fontWeight: '800',
    color: '#FFD83D',
  },

  projectionMeta: {
    marginTop: 8,
    maxWidth: 700,
    fontSize: 13,
    lineHeight: 18,
    color: '#D9D4B6',
  },

  progressPanel: {
    flex: 0.8,
    minWidth: 280,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#2A2E3A',
    borderWidth: 1,
    borderColor: '#3A3F4D',
  },

  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  progressLabel: {
    fontSize: 12,
    color: '#D9D4B6',
  },

  progressStatus: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD83D',
  },

  progressTrack: {
    height: 8,
    marginTop: 15,
    borderRadius: 5,
    backgroundColor: '#454A57',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 5,
  },

  progressBlue: {
    backgroundColor: '#F4C400',
  },

  progressGreen: {
    backgroundColor: '#43D29D',
  },

  progressOrange: {
    backgroundColor: '#FFB84A',
  },

  progressFootRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  progressFootText: {
    fontSize: 11,
    color: '#BDB58A',
  },

  actionRow: {
    width: '100%',
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },

  disclaimer: {
    flex: 1,
    maxWidth: 900,
    fontSize: 12,
    lineHeight: 16,
    color: '#5A4918',
  },

  saveButton: {
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: '#171A24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#171A24',
    shadowOpacity: 0.20,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFD83D',
    fontSize: 14,
    fontWeight: '800',
  },
});

