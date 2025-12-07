import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundGradientFrom: '#111827',
  backgroundGradientTo: '#111827',
  decimalPlaces: 2,
  color: (opacity = 1) => `rgba(251, 191, 36, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(229, 231, 235, ${opacity})`,
};

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  // filter: 'all' | 'week' | 'month'
  const [filter, setFilter] = useState('all');

  // editing state
  const [editingExpense, setEditingExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT * FROM expenses ORDER BY date DESC, id DESC;'
    );
    setExpenses(rows);
  };

  const addExpense = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      alert('Amount must be a positive number.');
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    if (!trimmedCategory) {
      alert('Category is required.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, today]
    );

    setAmount('');
    setCategory('');
    setNote('');

    loadExpenses();
  };

  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  // ---------- helpers for filters ----------
  const getStartOfWeek = () => {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon...
    const diffToMonday = (dayOfWeek + 6) % 7; // treat Monday as Monday-start
    d.setDate(d.getDate() - diffToMonday);
    return d;
  };

  const getStartOfMonth = () => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  };

  const filteredExpenses = useMemo(() => {
    if (filter === 'all') return expenses;

    const today = new Date();

    if (filter === 'week') {
      const startOfWeek = getStartOfWeek();
      return expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= startOfWeek && d <= today;
      });
    }

    if (filter === 'month') {
      const startOfMonth = getStartOfMonth();
      return expenses.filter((e) => {
        const d = new Date(e.date);
        return d >= startOfMonth && d <= today;
      });
    }

    return expenses;
  }, [expenses, filter]);

  const filterLabel =
    filter === 'all' ? 'All' : filter === 'week' ? 'This Week' : 'This Month';

  // ---------- totals ----------
  const totalSpending = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [filteredExpenses]);

  const totalsByCategory = useMemo(() => {
    const totals = {};
    for (const e of filteredExpenses) {
      const cat = e.category || 'Other';
      if (!totals[cat]) totals[cat] = 0;
      totals[cat] += Number(e.amount);
    }
    return totals;
  }, [filteredExpenses]);
const pieChartData = useMemo(() => {
  const entries = Object.entries(totalsByCategory);
  if (entries.length === 0) return [];

  const colors = ['#fbbf24', '#3b82f6', '#10b981', '#f97316', '#a855f7'];

  return entries.map(([category, total], index) => ({
    name: category,
    population: total,
    color: colors[index % colors.length],
    legendFontColor: '#e5e7eb',
    legendFontSize: 12,
  }));
}, [totalsByCategory]);

  // ---------- editing ----------
  const startEditing = (expense) => {
    setEditingExpense(expense);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setEditNote(expense.note || '');
    setEditDate(expense.date); // already "YYYY-MM-DD"
  };

  const saveEdit = async () => {
    if (!editingExpense) return;

    const amountNumber = parseFloat(editAmount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      alert('Amount must be a positive number.');
      return;
    }

    const trimmedCategory = editCategory.trim();
    const trimmedNote = editNote.trim();
    const trimmedDate = editDate.trim();

    if (!trimmedCategory) {
      alert('Category is required.');
      return;
    }

    if (!trimmedDate) {
      alert('Date is required (YYYY-MM-DD).');
      return;
    }

    await db.runAsync(
      `
      UPDATE expenses
      SET amount = ?, category = ?, note = ?, date = ?
      WHERE id = ?;
      `,
      [amountNumber, trimmedCategory, trimmedNote || null, trimmedDate, editingExpense.id]
    );

    setEditingExpense(null);
    await loadExpenses();
  };

  const renderExpense = ({ item }) => (
    <TouchableOpacity onPress={() => startEditing(item)}>
      <View style={styles.expenseRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.expenseAmount}>
            ${Number(item.amount).toFixed(2)}
          </Text>
          <Text style={styles.expenseCategory}>{item.category}</Text>
          {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
          {item.date ? (
            <Text style={styles.expenseDate}>Date: {item.date}</Text>
          ) : null}
        </View>

        <TouchableOpacity onPress={() => deleteExpense(item.id)}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);

      await loadExpenses();
    }

    setup();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* Filter buttons */}
      <View style={styles.filterRow}>
        <Button
          title="All"
          onPress={() => setFilter('all')}
          color={filter === 'all' ? '#fbbf24' : '#6b7280'}
        />
        <Button
          title="This Week"
          onPress={() => setFilter('week')}
          color={filter === 'week' ? '#fbbf24' : '#6b7280'}
        />
        <Button
          title="This Month"
          onPress={() => setFilter('month')}
          color={filter === 'month' ? '#fbbf24' : '#6b7280'}
        />
      </View>

      {/* Totals */}
      <View style={styles.totalsBox}>
        <Text style={styles.totalHeading}>
          Total Spending ({filterLabel}):
        </Text>
        <Text style={styles.totalAmount}>
          ${totalSpending.toFixed(2)}
        </Text>

        <Text style={[styles.totalHeading, { marginTop: 8 }]}>
          By Category ({filterLabel}):
        </Text>
        {Object.keys(totalsByCategory).length === 0 ? (
          <Text style={styles.totalText}>No expenses in this range.</Text>
        ) : (
          Object.entries(totalsByCategory).map(([cat, total]) => (
            <Text key={cat} style={styles.totalText}>
              • {cat}: ${total.toFixed(2)}
            </Text>
          ))
        )}
        {pieChartData.length > 0 && (
  <View style={styles.chartContainer}>
    <Text style={styles.chartTitle}>
      Spending by Category ({filterLabel})
    </Text>
    <PieChart
      data={pieChartData}
      width={screenWidth - 32}
      height={220}
      chartConfig={chartConfig}
      accessor="population"
      backgroundColor="transparent"
      paddingLeft="16"
      absolute
    />
  </View>
)}

      </View>

      {/* Add form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <Button title="Add Expense" onPress={addExpense} />
      </View>

      {/* List */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet.</Text>
        }
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>

      {/* Edit Modal */}
      <Modal
        visible={!!editingExpense}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditingExpense(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Edit Expense</Text>

            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#9ca3af"
              value={editCategory}
              onChangeText={setEditCategory}
            />
            <TextInput
              style={styles.input}
              placeholder="Note"
              placeholderTextColor="#9ca3af"
              value={editNote}
              onChangeText={setEditNote}
            />
            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor="#9ca3af"
              value={editDate}
              onChangeText={setEditDate}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <Button title="Save" onPress={saveEdit} />
              <Button
                title="Cancel"
                color="#f87171"
                onPress={() => setEditingExpense(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
  backgroundColor: '#1f2937',
  borderRadius: 12,
  paddingVertical: 16,
  paddingHorizontal: 8,
  marginBottom: 16,
},
chartTitle: {
  color: '#e5e7eb',
  fontSize: 16,
  fontWeight: '600',
  textAlign: 'center',
  marginBottom: 8,
},

  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expenseDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  totalsBox: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  totalHeading: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  totalAmount: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  totalText: {
    color: '#d1d5db',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
  },
  modalHeading: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
});

