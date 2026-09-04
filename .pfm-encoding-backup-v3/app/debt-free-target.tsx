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
  getLoans,
} from '../src/services/loanService';

import {
  getAllPayments,
} from '../src/services/paymentService';

import {
  getPortfolioLoanPositionMetrics,
} from '../src/services/loanMetricsService';

import {
  getAmortizationSchedule,
} from '../src/services/amortizationService';

import {
  getDebtFreeTarget,
  saveDebtFreeTarget,
} from '../src/services/debtFreeTargetService';

import {
  calculateTargetPerformance,
} from '../src/engine/targetPerformance';


function getMonthlyCommitment(loan: any): number {
  if (
    String(loan?.repaymentType || '').toUpperCase() ===
    'INTEREST_ONLY'
  ) {
    return Number(loan?.monthlyInterest || 0);
  }

  return Number(loan?.emi || 0);
}


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
    recommendedExtra,
    setRecommendedExtra,
  ] = useState(0);

  const [
    actualExtraPaidThisMonth,
    setActualExtraPaidThisMonth,
  ] = useState(0);

  const [
    extraStillNeededThisMonth,
    setExtraStillNeededThisMonth,
  ] = useState(0);


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
        loans,
        payments,
        existingTarget,
      ] =
        await Promise.all([
          getLoans(),
          getAllPayments(),
          getDebtFreeTarget(),
        ]);

      /*
       * IMPORTANT:
       * Debt-free journey must use exactly the same authoritative
       * loan-position calculation as My Loans, Dashboard and Insights.
       *
       * Persisted amortization schedules are therefore preferred and
       * actual payment records are used only by the centralized
       * loanMetricsService fallback path.
       */
      const safeLoans = loans || [];
      const safePayments = payments || [];

      const positionMetrics =
        await getPortfolioLoanPositionMetrics(
          safeLoans,
          safePayments,
          new Date(),
        );

      const activePositions =
        positionMetrics.filter(
          ({ loan }) =>
            String(loan.status || '').toUpperCase() === 'ACTIVE',
        );

      /*
       * The target calculator needs the same future amortization rows that
       * drive My Loans.  Attach them as a private calculation-only field;
       * the existing loan model and UI are not changed.
       */
      const schedules = await Promise.all(
        activePositions.map(async ({ loan }) => {
          if (!loan.id) return [];
          try {
            return await getAmortizationSchedule(loan.id);
          } catch (error) {
            console.warn(
              '[DebtFreeTarget] Unable to load amortization schedule for target calculation.',
              error,
            );
            return [];
          }
        }),
      );

      const calculatedLoans =
        activePositions.map(
          ({ loan, position }, index) => ({
            ...loan,
            currentOutstanding:
              Number(position.currentOutstanding) || 0,
            remainingMonths:
              Number(position.remainingMonths) || 0,
            nextEmiDate:
              position.nextEmiDate,
            lastEmiDate:
              position.lastEmiDate,
            __amortizationSchedule:
              schedules[index],
          }),
        );

      const currentOutstanding =
        activePositions.reduce(
          (sum, { position }) =>
            sum +
            (Number(position.currentOutstanding) || 0),
          0,
        );

      const currentEMI =
        activePositions.reduce(
          (sum, { loan }) =>
            sum +
            getMonthlyCommitment(loan),
          0,
        );

      const canonicalSummary = {
        totalOutstanding: currentOutstanding,
        totalMonthlyEMI: currentEMI,
        loans: calculatedLoans.map(
          (loan) => ({ loan }),
        ),
        payments: safePayments,
      };

      setDashboardSummary(
        canonicalSummary,
      );

      setOutstanding(
        currentOutstanding,
      );

      setBaselineOutstanding(
        currentOutstanding,
      );

      setBaselineDate(
        formatDateInput(new Date()),
      );

      setMonthlyEMI(
        currentEMI,
      );


      let effectiveTargetDate = '';
      let effectiveAdditionalPayment = 0;

      if (
        existingTarget
      ) {

        effectiveTargetDate = String(existingTarget.targetDate || '');
        effectiveAdditionalPayment = Math.max(
          0,
          Number(existingTarget.additionalMonthlyPayment) || 0,
        );

        setTargetDate(
          effectiveTargetDate
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
          String(effectiveAdditionalPayment)
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

        effectiveTargetDate = formatDateInput(date);
        effectiveAdditionalPayment = 0;

        setTargetDate(
          effectiveTargetDate
        );

      }

      if (effectiveTargetDate) {
        calculatePreview(
          canonicalSummary,
          effectiveTargetDate,
          effectiveAdditionalPayment,
          safePayments,
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

    const plannedExtra = Math.max(
      0,
      Number(additionalPayment) || 0,
    );

    calculatePreview(
      dashboardSummary,
      targetDate,
      plannedExtra,
      dashboardSummary.payments || [],
    );
  }, [
    dashboardSummary,
    targetDate,
    additionalPayment,
  ]);


  /*
   * --------------------------------------------------
   * PREVIEW
   * --------------------------------------------------
   */

  function calculatePreview(
    summary: any,
    dateValue: string,
    plannedExtra: number,
    payments: any[] = [],
  ) {

    if (!dateValue) return;

    const target = new Date(dateValue);

    if (Number.isNaN(target.getTime())) return;

    const performance = calculateTargetPerformance(
      summary.loans.map(
        (item: any) => item.loan,
      ),
      target,
      payments,
      plannedExtra,
    );

    setRecommendedExtra(
      Number(performance.requiredAdditionalPrincipal) || 0,
    );

    setActualExtraPaidThisMonth(
      Number(performance.additionalPrincipalPaidThisMonth) || 0,
    );

    setExtraStillNeededThisMonth(
      Number(performance.additionalPrincipalRemainingThisMonth) || 0,
    );

    setProjectedDate(
      performance.projectedDebtFreeDate,
    );

    setStatus(
      performance.status,
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


      router.back();

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
            <Text style={styles.loadingOrbText}>â—·</Text>
          </View>
          <Text style={styles.loadingTitle}>Preparing your target</Text>
          <Text style={styles.loadingText}>Loading your current loan positionâ€¦</Text>
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
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Text style={styles.backButtonText}>â† Back</Text>
          </Pressable>
        </View>

        {/* CURRENT POSITION */}
        <View style={styles.positionGrid}>
          <View style={[styles.metricCard, styles.metricBlue]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>CURRENT OUTSTANDING</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>â‚¹</Text></View>
            </View>
            <Text style={styles.metricValueLight}>{formatCurrency(outstanding)}</Text>
            <Text style={styles.metricCaptionLight}>Balance captured for this target</Text>
          </View>

          <View style={[styles.metricCard, styles.metricGreen]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>MONTHLY COMMITMENT</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>â†—</Text></View>
            </View>
            <Text style={styles.metricValueLight}>{formatCurrency(monthlyEMI)}</Text>
            <Text style={styles.metricCaptionLight}>Regular loan repayment</Text>
          </View>

          <View style={[styles.metricCard, styles.metricPurple]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>TARGET DATE</Text>
              <View style={styles.metricIconLight}><Text style={styles.metricIconText}>â—·</Text></View>
            </View>
            <Text style={styles.metricValueLightSmall}>
              {validTargetDate ? formatDate(targetDateObj as Date) : 'â€”'}
            </Text>
            <Text style={styles.metricCaptionLight}>Your desired debt-free date</Text>
          </View>

          <View style={[styles.metricCard, styles.metricOrange]}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabelLight}>PLANNED EXTRA</Text>
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
              <Text style={styles.cardIconTextBlue}>â—·</Text>
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
              <Text style={styles.currencyPrefix}>â‚¹</Text>
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

            <View style={styles.recommendationBox}>
              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>Recommended extra / month</Text>
                <Text style={styles.recommendationValue}>{formatCurrency(recommendedExtra)}</Text>
              </View>
              <Text style={styles.recommendationHint}>
                Calculated from today's outstanding balance, interest rates, EMI and your target date.
              </Text>
              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>Extra paid this month</Text>
                <Text style={styles.recommendationActual}>{formatCurrency(actualExtraPaidThisMonth)}</Text>
              </View>
              <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>Still needed this month</Text>
                <Text style={styles.recommendationRemaining}>{formatCurrency(extraStillNeededThisMonth)}</Text>
              </View>
              <Text style={styles.recalculationNote}>
                The recommendation is recalculated from your latest outstanding balance and remaining time to the target. If no extra payment is made, the required extra will increase as the target gets closer.
              </Text>
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
                Based on today's outstanding balance and your planned monthly contribution.
              </Text>
            </View>
            {projectedDate && (
              <View style={[
                styles.statusPill,
                status === 'AHEAD' ? styles.statusAhead : status === 'ON_TRACK' ? styles.statusTrack : styles.statusBehind,
              ]}>
                <Text style={styles.statusPillText}>
                  {status === 'AHEAD' ? 'â†— Ahead of target' : status === 'ON_TRACK' ? 'âœ“ On track' : '! Needs attention'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.projectionBody}>
            <View style={styles.projectionDateBlock}>
              <Text style={styles.projectionLabel}>PROJECTED DEBT-FREE DATE</Text>
              <Text style={styles.projectionDate}>
                {projectedDate ? formatDate(projectedDate) : 'â€”'}
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
                  {status === 'AHEAD' ? 'AHEAD' : status === 'ON_TRACK' ? 'ON TRACK' : status === 'BEHIND' ? 'BEHIND' : 'â€”'}
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
  return `â‚¹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { width: '100%', paddingHorizontal: 28, paddingTop: 28, paddingBottom: 60 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F7FB', padding: 30 },
  loadingOrb: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center' },
  loadingOrbText: { fontSize: 33, color: '#356DFF', fontWeight: '800' },
  loadingTitle: { marginTop: 18, fontSize: 21, fontWeight: '800', color: '#172033' },
  loadingText: { marginTop: 7, fontSize: 14, color: '#7A8496' },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, gap: 20 },
  headerCopy: { flex: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#356DFF' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#356DFF' },
  title: { fontSize: 37, fontWeight: '800', color: '#172033', letterSpacing: -0.5 },
  subtitle: { marginTop: 6, maxWidth: 760, fontSize: 15, lineHeight: 20, color: '#748095' },
  backButton: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E8F0' },
  backButtonText: { fontSize: 14, fontWeight: '700', color: '#46536A' },
  pressed: { opacity: 0.78 },
  positionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 30 },
  metricCard: { flexGrow: 1, flexBasis: 240, minHeight: 145, padding: 20, borderRadius: 20, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  metricBlue: { backgroundColor: '#356DFF', shadowColor: '#356DFF' },
  metricGreen: { backgroundColor: '#18A673', shadowColor: '#18A673' },
  metricPurple: { backgroundColor: '#7857D8', shadowColor: '#7857D8' },
  metricOrange: { backgroundColor: '#E99A32', shadowColor: '#E99A32' },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLabelLight: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.78)' },
  metricIconLight: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  metricIconText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  metricValueLight: { marginTop: 17, fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  metricValueLightSmall: { marginTop: 18, fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  metricCaptionLight: { marginTop: 5, fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14, gap: 20 },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#7857D8' },
  sectionTitle: { marginTop: 4, fontSize: 24, fontWeight: '800', color: '#172033' },
  sectionHint: { fontSize: 12, color: '#8993A4' },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  formCard: { flexGrow: 1, flexBasis: 420, padding: 22, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E9F1', shadowColor: '#1B2942', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  cardIconBlue: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  cardIconOrange: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFF3E3', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  cardIconTextBlue: { color: '#356DFF', fontSize: 20, fontWeight: '800' },
  cardIconTextOrange: { color: '#E99A32', fontSize: 21, fontWeight: '800' },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#172033' },
  helpText: { marginTop: 6, fontSize: 13, lineHeight: 18, color: '#7A8496' },
  inputLabel: { marginTop: 19, marginBottom: 7, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: '#647086' },
  input: { height: 50, borderWidth: 1, borderColor: '#DCE2EC', borderRadius: 12, paddingHorizontal: 14, fontSize: 18, color: '#172033', backgroundColor: '#FAFBFD' },
  inputHint: { marginTop: 6, fontSize: 12, color: '#9AA4B5' },
  amountInputRow: { height: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DCE2EC', borderRadius: 12, backgroundColor: '#FAFBFD' },
  currencyPrefix: { paddingLeft: 15, fontSize: 21, fontWeight: '800', color: '#E99A32' },
  amountInput: { flex: 1, height: 50, paddingHorizontal: 10, fontSize: 19, color: '#172033' },
  plannedRow: { marginTop: 13, paddingTop: 13, borderTopWidth: 1, borderTopColor: '#EDF0F5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plannedLabel: { fontSize: 13, color: '#7A8496' },
  plannedValue: { fontSize: 18, fontWeight: '800', color: '#18A673' },
  recommendationBox: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#F6F8FC', borderWidth: 1, borderColor: '#E7EBF2' },
  recommendationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 7 },
  recommendationLabel: { flex: 1, fontSize: 12, color: '#6F7B90' },
  recommendationValue: { fontSize: 18, fontWeight: '800', color: '#356DFF' },
  recommendationActual: { fontSize: 15, fontWeight: '800', color: '#18A673' },
  recommendationRemaining: { fontSize: 15, fontWeight: '800', color: '#E99A32' },
  recommendationHint: { marginTop: 2, fontSize: 11, lineHeight: 14, color: '#98A2B3' },
  recalculationNote: { marginTop: 10, fontSize: 12, lineHeight: 15, color: '#172033' },
  projectionCard: { marginTop: 22, padding: 24, borderRadius: 22, backgroundColor: '#172B55', shadowColor: '#172B55', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 5 },
  projectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 },
  projectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#91AEFF' },
  projectionTitle: { marginTop: 5, fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  projectionSubtitle: { marginTop: 5, maxWidth: 650, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.65)' },
  statusPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  statusAhead: { backgroundColor: '#DDF7EC' },
  statusTrack: { backgroundColor: '#E5EDFF' },
  statusBehind: { backgroundColor: '#FFF0D9' },
  statusPillText: { fontSize: 12, fontWeight: '800', color: '#24304A' },
  projectionBody: { marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' },
  projectionDateBlock: { flex: 1, minWidth: 280 },
  projectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.52)' },
  projectionDate: { marginTop: 8, fontSize: 37, fontWeight: '800', color: '#FFFFFF' },
  projectionMeta: { marginTop: 8, maxWidth: 600, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.65)' },
  progressPanel: { flex: 0.8, minWidth: 280, padding: 18, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)' },
  progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  progressStatus: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  progressTrack: { height: 8, marginTop: 15, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  progressBlue: { backgroundColor: '#6F96FF' },
  progressGreen: { backgroundColor: '#43D29D' },
  progressOrange: { backgroundColor: '#F1B25F' },
  progressFootRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  progressFootText: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  actionRow: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  disclaimer: { flex: 1, maxWidth: 760, fontSize: 12, lineHeight: 16, color: '#8A94A5' },
  saveButton: { minHeight: 50, paddingHorizontal: 22, borderRadius: 14, backgroundColor: '#356DFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#356DFF', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});

