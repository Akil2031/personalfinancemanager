import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Loan } from '../models/loan';
import { AmortizationEntry, AmortizationEntryType } from '../models/amortization';
import {
  getAmortizationSchedule, replaceAmortizationSchedule,
  syncAutomaticEmiStatuses, updateAmortizationStatus,
  calculateAuthoritativeLoanMetrics,
} from '../services/amortizationService';
import { calculateEMI } from '../engine/emiCalculator';
import {
  recalculateFutureAmortization,
  AmortizationChangedField,
} from '../services/amortizationRecalculationService';

interface Props { loan: Loan; onBack?: () => void; }
type Draft = { entryType: AmortizationEntryType; installmentNo: string; dueDate: string; emi: string; openingBalance: string; principal: string; interest: string; closingBalance: string; notes: string; };
const ENTRY_TYPES: AmortizationEntryType[] = ['EMI','PART_PREPAYMENT','PREPAYMENT','ADJUSTMENT'];
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const money=(v:number)=>Math.round(num(v)).toLocaleString('en-IN');
const today=()=>new Date().toISOString().slice(0,10);
function emptyDraft():Draft{return{entryType:'EMI',installmentNo:'',dueDate:'',emi:'',openingBalance:'',principal:'',interest:'',closingBalance:'',notes:''};}
function dateOnly(v:string){const d=new Date(v);return Number.isNaN(d.getTime())?v.trim():d.toISOString().slice(0,10);}
function labelForType(t:AmortizationEntryType){return t==='PART_PREPAYMENT'?'B - Part Prepayment':t==='PREPAYMENT'?'Prepayment':t==='ADJUSTMENT'?'Adjustment':'EMI';}
function toDraft(r?:AmortizationEntry):Draft{if(!r)return emptyDraft();return{entryType:r.entryType,installmentNo:r.installmentNo==null?'':String(r.installmentNo),dueDate:r.dueDate?.slice(0,10)||'',emi:String(num(r.emi)),openingBalance:String(num(r.openingBalance)),principal:String(num(r.principal)),interest:String(num(r.interest)),closingBalance:String(num(r.closingBalance)),notes:r.notes||''};}

export default function AmortizationScheduleScreen({loan,onBack}:Props){
 const [rows,setRows]=useState<AmortizationEntry[]>([]); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);
 const [editorVisible,setEditorVisible]=useState(false); const [editingIndex,setEditingIndex]=useState<number|null>(null); const [draft,setDraft]=useState<Draft>(emptyDraft()); const [changedField,setChangedField]=useState<AmortizationChangedField>('CLOSING_BALANCE');
 const load=async()=>{if(!loan.id){setRows([]);setLoading(false);return;}try{setLoading(true);let data=await getAmortizationSchedule(loan.id);if(!data.length){const c=calculateEMI({principal:num(loan.originalPrincipal),annualInterestRate:num(loan.annualInterestRate),tenureMonths:num(loan.tenureMonths),firstEmiDate:new Date(loan.firstEmiDate)});const now=today();data=c.schedule.map((r,i)=>{const due=r.dueDate.toISOString().slice(0,10);const past=due<now;return{id:undefined,loanId:loan.id!,sequenceNo:i+1,entryType:'EMI',installmentNo:r.installmentNo,dueDate:due,emi:r.emi,openingBalance:r.openingBalance,principal:r.principal,interest:r.interest,closingBalance:r.closingBalance,status:past?'PAID':'UPCOMING',statusSource:past?'AUTO':undefined,paidDate:past?due:undefined,paidAmount:past?r.emi:undefined,source:'CALCULATED',notes:''};});}else{data=await syncAutomaticEmiStatuses(loan.id,new Date());}setRows(data);}catch(e){console.error(e);Alert.alert('Error','Unable to load amortization schedule.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[loan.id]);
 const totalScheduled=useMemo(()=>rows.reduce((s,r)=>s+num(r.emi),0),[rows]);
 const metrics=useMemo(()=>calculateAuthoritativeLoanMetrics(loan,rows,new Date()),[loan,rows]); const totalPaid=metrics.totalPaid; const outstanding=metrics.currentOutstanding; const principalPaid=metrics.principalPaid; const interestPaid=metrics.interestPaid;
 const closeEditor=()=>{setEditorVisible(false);setEditingIndex(null);setDraft(emptyDraft());};
 const openAdd=()=>{setEditingIndex(null);setDraft(emptyDraft());setEditorVisible(true);};
 const openEdit=(i:number)=>{setEditingIndex(i);setDraft(toDraft(rows[i]));setEditorVisible(true);};
 const persistSchedule=async(nextRows:AmortizationEntry[], showMessage=false)=>{
  if(!loan.id) throw new Error('Loan ID is required.');
  const ordered=[...nextRows]
    .sort((a,b)=>a.dueDate.localeCompare(b.dueDate))
    .map((r,i)=>({...r,loanId:loan.id!,sequenceNo:i+1}));
  await replaceAmortizationSchedule(loan.id,ordered);
  const refreshed=await syncAutomaticEmiStatuses(loan.id,new Date());
  setRows(refreshed);
  if(showMessage){
    if(Platform.OS==='web') window.alert('Changes saved successfully.');
    else Alert.alert('Saved','Changes saved successfully.');
  }
 };

 const saveDraft=async()=>{
  const type=draft.entryType, emi=num(draft.emi);
  if(!draft.dueDate.trim()) return Alert.alert('Validation','Please enter the date.');
  if(type==='EMI'&&emi<=0) return Alert.alert('Validation','Please enter the EMI amount.');
  const old=editingIndex==null?undefined:rows[editingIndex];
  const entry:AmortizationEntry={
    id:old?.id, loanId:loan.id!, sequenceNo:old?.sequenceNo||rows.length+1,
    entryType:type, installmentNo:draft.installmentNo.trim()?Number(draft.installmentNo):undefined,
    dueDate:dateOnly(draft.dueDate), emi, openingBalance:num(draft.openingBalance),
    principal:num(draft.principal), interest:num(draft.interest), closingBalance:num(draft.closingBalance),
    status:old?.status||'SCHEDULED', statusSource:old?.statusSource, paidDate:old?.paidDate,
    paidAmount:old?.paidAmount, source:old?.source||'MANUAL', isManuallyAdjusted:true, notes:draft.notes.trim()
  };
  const next=editingIndex==null
    ? [...rows,entry]
    : rows.map((r,i)=>i===editingIndex?entry:r);
  try{
    setSaving(true);

    // The edited row is the new anchor. Recalculate every future row from its
    // closing balance before persisting, so an adjustment immediately flows
    // through the remaining amortization schedule.
    const sortedNext=[...next].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    const changedDate=entry.dueDate;
    const changedPosition=sortedNext.findIndex(r =>
      r === entry || (r.dueDate === changedDate && r.installmentNo === entry.installmentNo && r.isManuallyAdjusted)
    );
    const recalculated=recalculateFutureAmortization(
      loan,
      sortedNext,
      changedPosition >= 0 ? changedPosition : 0,
      changedField,
    );
    await persistSchedule(recalculated,false);
    closeEditor();
    if(Platform.OS==='web') window.alert('Entry saved successfully.');
    else Alert.alert('Saved','Entry saved successfully.');
  }catch(e){
    console.error(e);
    Alert.alert('Save Failed',e instanceof Error?e.message:'Unable to save the entry.');
  }finally{setSaving(false);}
 };

 const remove=(i:number)=>{
  const action=async()=>{
    try{
      setSaving(true);
      const next=rows.filter((_,x)=>x!==i).map((r,x)=>({...r,sequenceNo:x+1}));
      if(!next.length){
        Alert.alert('Validation','At least one amortization entry is required.');
        return;
      }
      await persistSchedule(next,false);
      if(Platform.OS==='web') window.alert('Entry deleted and schedule saved.');
      else Alert.alert('Deleted','Entry deleted and schedule saved.');
    }catch(e){
      console.error(e);
      Alert.alert('Delete Failed',e instanceof Error?e.message:'Unable to delete the entry.');
    }finally{setSaving(false);}
  };
  if(Platform.OS==='web'){if(window.confirm('Delete this amortization entry?')) void action();}
  else Alert.alert('Delete Entry','Delete this amortization entry?',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:()=>void action()}]);
 };
 const togglePaid=async(row:AmortizationEntry,index:number)=>{if(row.entryType!=='EMI')return;const paid=row.status!=='PAID';const paidDate=paid?(row.dueDate||today()):'';const paidAmount=paid?num(row.paidAmount??row.emi):0;if(!row.id || row.id.startsWith('draft-')){setRows(p=>p.map((r,i)=>i===index?{...r,status:paid?'PAID':'UNPAID',statusSource:'MANUAL',paidDate,paidAmount}:r));return;}try{await updateAmortizationStatus(loan.id!,row.id,paid?'PAID':'UNPAID',{source:'MANUAL',paidDate,paidAmount});setRows(p=>p.map((r,i)=>i===index?{...r,status:paid?'PAID':'UNPAID',statusSource:'MANUAL',paidDate,paidAmount}:r));}catch(e){console.error(e);Alert.alert('Update Failed',e instanceof Error?e.message:'Unable to update payment status.');}};
 const save=async()=>{if(!loan.id||!rows.length)return Alert.alert('Validation','Add at least one schedule entry.');try{setSaving(true);const ordered=[...rows].sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map((r,i)=>({...r,loanId:loan.id!,sequenceNo:i+1}));await replaceAmortizationSchedule(loan.id,ordered);const refreshed=await syncAutomaticEmiStatuses(loan.id,new Date());setRows(refreshed);if(Platform.OS==='web')window.alert('Amortization schedule saved successfully.');else Alert.alert('Saved','Amortization schedule saved successfully.');}catch(e){console.error(e);Alert.alert('Save Failed','Unable to save amortization schedule.');}finally{setSaving(false);}};
 return <View style={styles.container}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
  <View style={styles.header}><View style={styles.headerLeft}>{onBack&&<Pressable style={styles.backButton} onPress={onBack}><Text style={styles.backButtonText}>‹</Text></Pressable>}<View><Text style={styles.title}>Amortization Schedule</Text><Text style={styles.subtitle}>{loan.loanName} • {loan.lender}</Text></View></View><Pressable style={styles.saveButton} onPress={()=>void save()} disabled={saving}>{saving?<ActivityIndicator size="small" color="#FFFFFF"/>:<Text style={styles.saveButtonText}>Save Schedule</Text>}</Pressable></View>
  <View style={styles.summary}><Summary label="Entries" value={String(rows.length)}/><Summary label="Scheduled Total" value={`₹${money(totalScheduled)}`}/><Summary label="Principal Paid" value={`₹${money(principalPaid)}`}/><Summary label="Interest Paid" value={`₹${money(interestPaid)}`}/><Summary label="Paid" value={`₹${money(totalPaid)}`}/><Summary label="Outstanding Principal" value={`₹${money(outstanding)}`}/></View>
  <View style={styles.toolbar}><View><Text style={styles.sectionTitle}>Lender Schedule</Text><Text style={styles.sectionSubtitle}>The lender values are the source of truth. Payment status is tracked on each EMI.</Text></View><Pressable style={styles.addButton} onPress={openAdd}><Text style={styles.addButtonText}>+ Add Entry</Text></Pressable></View>
  {loading?<View style={styles.loading}><ActivityIndicator color="#356DFF"/><Text style={styles.loadingText}>Loading schedule...</Text></View>:!rows.length?<View style={styles.empty}><Text style={styles.emptyTitle}>No amortization entries</Text><Text style={styles.emptyText}>Add the lender schedule using + Add Entry.</Text></View>:<ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}><View style={styles.table}>
   <View style={styles.tableHeader}><Text style={[styles.headerCell,styles.seq]}>#</Text><Text style={[styles.headerCell,styles.type]}>Type</Text><Text style={[styles.headerCell,styles.date]}>Date</Text><Text style={[styles.headerCell,styles.money]}>EMI</Text><Text style={[styles.headerCell,styles.money]}>Opening</Text><Text style={[styles.headerCell,styles.money]}>Principal</Text><Text style={[styles.headerCell,styles.money]}>Interest</Text><Text style={[styles.headerCell,styles.money]}>Closing</Text><Text style={[styles.headerCell,styles.status]}>Status</Text><Text style={[styles.headerCell,styles.actions]}>Action</Text></View>
   {rows.map((row,i)=>{const isEmi=row.entryType==='EMI';const due=row.dueDate<today();const paid=row.status==='PAID';return <View style={styles.tableRow} key={row.id||`${row.sequenceNo}-${i}`}><Text style={[styles.cell,styles.seq]}>{i+1}</Text><Text style={[styles.cell,styles.type]}>{labelForType(row.entryType)}</Text><Text style={[styles.cell,styles.date]}>{row.dueDate.slice(0,10)}</Text><Text style={[styles.cell,styles.money]}>₹{money(row.emi)}</Text><Text style={[styles.cell,styles.money]}>₹{money(row.openingBalance)}</Text><Text style={[styles.cell,styles.money]}>₹{money(row.principal)}</Text><Text style={[styles.cell,styles.money]}>₹{money(row.interest)}</Text><Text style={[styles.cell,styles.money]}>₹{money(row.closingBalance)}</Text><View style={[styles.statusArea,styles.status]}>{isEmi?(<Pressable onPress={()=>void togglePaid(row,i)} style={[styles.checkButton,paid&&styles.checkButtonPaid,!due&&styles.checkButtonDisabled]}><Text style={[styles.checkText,paid&&styles.checkTextPaid]}>{paid?'✓':'○'} {paid?'PAID':due?'UNPAID':'UPCOMING'}</Text></Pressable>):<Text style={styles.entryStatus}>{labelForType(row.entryType)}</Text>}</View><View style={[styles.actionArea,styles.actions]}><Pressable style={styles.editButton} onPress={()=>openEdit(i)}><Text style={styles.editButtonText}>Edit</Text></Pressable><Pressable style={styles.deleteButton} onPress={()=>remove(i)}><Text style={styles.deleteButtonText}>Delete</Text></Pressable></View></View>})}
  </View></ScrollView>}
 </ScrollView>
 <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={closeEditor}><View style={styles.modalBackdrop}><View style={styles.modalCard}><ScrollView showsVerticalScrollIndicator={false}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editingIndex==null?'Add Schedule Entry':'Edit Schedule Entry'}</Text><Pressable onPress={closeEditor}><Text style={styles.closeText}>×</Text></Pressable></View><Text style={styles.fieldLabel}>Entry Type</Text><View style={styles.typeChoices}>{ENTRY_TYPES.map(t=><Pressable key={t} style={[styles.typeChoice,draft.entryType===t&&styles.typeChoiceSelected]} onPress={()=>{setChangedField('ENTRY_TYPE');setDraft(d=>({...d,entryType:t}))}}><Text style={[styles.typeChoiceText,draft.entryType===t&&styles.typeChoiceTextSelected]}>{labelForType(t)}</Text></Pressable>)}</View><Field label="Installment No. (optional)" value={draft.installmentNo} onChangeText={v=>setDraft(d=>({...d,installmentNo:v}))} keyboardType="numeric" placeholder="Example: 1"/><Field label="Date" value={draft.dueDate} onChangeText={v=>{setChangedField('DATE');setDraft(d=>({...d,dueDate:v}))}} placeholder="YYYY-MM-DD"/><Field label="EMI Amount" value={draft.emi} onChangeText={v=>{setChangedField('EMI');setDraft(d=>({...d,emi:v}))}} keyboardType="numeric" placeholder="13765"/><Field label="Opening Balance" value={draft.openingBalance} onChangeText={v=>{setChangedField('OPENING_BALANCE');setDraft(d=>({...d,openingBalance:v}))}} keyboardType="numeric" placeholder="400000"/><Field label="Principal" value={draft.principal} onChangeText={v=>{setChangedField('PRINCIPAL');setDraft(d=>({...d,principal:v}))}} keyboardType="numeric" placeholder="6605"/><Field label="Interest" value={draft.interest} onChangeText={v=>{setChangedField('INTEREST');setDraft(d=>({...d,interest:v}))}} keyboardType="numeric" placeholder="7160"/><Field label="Closing Balance" value={draft.closingBalance} onChangeText={v=>{setChangedField('CLOSING_BALANCE');setDraft(d=>({...d,closingBalance:v}))}} keyboardType="numeric" placeholder="393395"/><Field label="Notes" value={draft.notes} onChangeText={v=>setDraft(d=>({...d,notes:v}))} placeholder="Optional" multiline/><Pressable style={styles.modalSave} onPress={()=>void saveDraft()} disabled={saving}><Text style={styles.modalSaveText}>{saving?'Saving...':'Save Entry'}</Text></Pressable></ScrollView></View></View></Modal>
 </View>;
}
function Summary({label,value}:{label:string;value:string}){return <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>}
function Field(p:{label:string;value:string;onChangeText:(v:string)=>void;placeholder?:string;keyboardType?:'default'|'numeric';multiline?:boolean}){return <View style={styles.field}><Text style={styles.fieldLabel}>{p.label}</Text><TextInput style={[styles.input,p.multiline&&styles.multiline]} value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor="#A0A9B8" keyboardType={p.keyboardType||'default'} multiline={p.multiline}/></View>}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:'#F5F7FB'},content:{width:'100%',paddingHorizontal:28,paddingTop:24,paddingBottom:48},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:18,padding:20,borderRadius:18,backgroundColor:'#FFF',borderWidth:1,borderColor:'#E3E8F1'},headerLeft:{flexDirection:'row',alignItems:'center',flex:1},backButton:{width:40,height:40,borderRadius:12,backgroundColor:'#EAF0FF',alignItems:'center',justifyContent:'center',marginRight:12},backButtonText:{fontSize:28,lineHeight:30,color:'#356DFF'},title:{fontFamily:'Inter_800ExtraBold',fontSize:24,color:'#172033'},subtitle:{marginTop:4,fontFamily:'Inter_400Regular',fontSize:11,color:'#738097'},saveButton:{marginLeft:14,paddingHorizontal:16,paddingVertical:11,borderRadius:10,backgroundColor:'#356DFF'},saveButtonText:{color:'#FFF',fontFamily:'Inter_700Bold',fontSize:10},summary:{flexDirection:'row',flexWrap:'wrap',gap:12,marginBottom:18},summaryCard:{minWidth:180,flex:1,padding:16,borderRadius:16,backgroundColor:'#FFF',borderWidth:1,borderColor:'#E3E8F1'},summaryLabel:{fontFamily:'Inter_500Medium',fontSize:10,color:'#738097'},summaryValue:{marginTop:7,fontFamily:'Inter_800ExtraBold',fontSize:18,color:'#172033'},toolbar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:14,marginBottom:12},sectionTitle:{fontFamily:'Inter_700Bold',fontSize:17,color:'#172033'},sectionSubtitle:{marginTop:4,fontFamily:'Inter_400Regular',fontSize:10,color:'#738097'},addButton:{paddingHorizontal:15,paddingVertical:10,borderRadius:10,backgroundColor:'#356DFF'},addButtonText:{fontFamily:'Inter_700Bold',fontSize:10,color:'#FFF'},loading:{paddingVertical:50,alignItems:'center',gap:10},loadingText:{fontFamily:'Inter_500Medium',fontSize:11,color:'#738097'},empty:{padding:50,alignItems:'center'},emptyTitle:{fontFamily:'Inter_700Bold',fontSize:15,color:'#172033'},emptyText:{marginTop:5,fontFamily:'Inter_400Regular',fontSize:11,color:'#738097'},tableScroll:{borderRadius:16},table:{minWidth:1500,borderRadius:16,overflow:'hidden',backgroundColor:'#FFF',borderWidth:1,borderColor:'#E3E8F1'},tableHeader:{flexDirection:'row',alignItems:'center',backgroundColor:'#F4F6FA',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#E3E8F1'},tableRow:{flexDirection:'row',alignItems:'center',minHeight:62,borderBottomWidth:1,borderBottomColor:'#EEF1F5'},headerCell:{fontFamily:'Inter_700Bold',fontSize:9,color:'#667085'},cell:{fontFamily:'Inter_500Medium',fontSize:10,color:'#344054'},seq:{width:45,textAlign:'center'},type:{width:155,paddingHorizontal:10},date:{width:105,paddingHorizontal:8},money:{width:115,paddingHorizontal:8,textAlign:'right'},status:{width:135,paddingHorizontal:8},actions:{width:150,paddingHorizontal:8},statusArea:{justifyContent:'center'},checkButton:{paddingHorizontal:9,paddingVertical:7,borderRadius:9,backgroundColor:'#FDECEC',borderWidth:1,borderColor:'#F5CACA'},checkButtonPaid:{backgroundColor:'#E8F7F0',borderColor:'#CBEBDC'},checkButtonDisabled:{backgroundColor:'#F3F4F6',borderColor:'#E5E7EB'},checkText:{fontFamily:'Inter_700Bold',fontSize:9,color:'#C0392B'},checkTextPaid:{color:'#168A61'},entryStatus:{fontFamily:'Inter_600SemiBold',fontSize:9,color:'#667085'},actionArea:{flexDirection:'row',alignItems:'center',gap:7},editButton:{paddingHorizontal:10,paddingVertical:7,borderRadius:8,backgroundColor:'#EEF3FF'},editButtonText:{fontFamily:'Inter_600SemiBold',fontSize:9,color:'#3156D3'},deleteButton:{paddingHorizontal:10,paddingVertical:7,borderRadius:8,backgroundColor:'#FDECEC'},deleteButtonText:{fontFamily:'Inter_600SemiBold',fontSize:9,color:'#C0392B'},modalBackdrop:{flex:1,backgroundColor:'rgba(15,23,42,0.35)',alignItems:'center',justifyContent:'center',padding:20},modalCard:{width:'100%',maxWidth:620,maxHeight:'90%',backgroundColor:'#FFF',borderRadius:18,padding:20},modalHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:15},modalTitle:{fontFamily:'Inter_700Bold',fontSize:18,color:'#172033'},closeText:{fontSize:28,color:'#667085'},field:{marginBottom:12},fieldLabel:{marginBottom:6,fontFamily:'Inter_600SemiBold',fontSize:10,color:'#344054'},input:{minHeight:44,borderWidth:1,borderColor:'#DCE2EA',borderRadius:10,paddingHorizontal:12,fontFamily:'Inter_400Regular',fontSize:12,color:'#172033',backgroundColor:'#FBFCFE'},multiline:{minHeight:70,paddingTop:10,textAlignVertical:'top'},typeChoices:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:15},typeChoice:{paddingHorizontal:10,paddingVertical:8,borderRadius:9,backgroundColor:'#F2F4F7',borderWidth:1,borderColor:'#E4E7EC'},typeChoiceSelected:{backgroundColor:'#EEF3FF',borderColor:'#356DFF'},typeChoiceText:{fontFamily:'Inter_600SemiBold',fontSize:9,color:'#667085'},typeChoiceTextSelected:{color:'#3156D3'},modalSave:{marginTop:8,paddingVertical:12,borderRadius:10,backgroundColor:'#356DFF',alignItems:'center'},modalSaveText:{fontFamily:'Inter_700Bold',fontSize:10,color:'#FFF'}});
