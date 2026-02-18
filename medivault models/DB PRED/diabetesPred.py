import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sb
import numpy as np
import pandas as pd
import seaborn as sb
import sklearn
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn import metrics
from sklearn.metrics import confusion_matrix
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import classification_report
from sklearn.metrics import accuracy_score


df = pd.read_csv("D:\CAPSTONE PROJECT\DB PRED\dataset1.csv")
print(df)
print(df.head(10))
df.describe()
df.info()
df.isna().sum()
df = df.dropna()
df.duplicated().sum()
print("Dataset dimensions:", df.shape)
df.drop_duplicates()


original_shape = df.shape

df = df.drop_duplicates()
new_shape = df.shape

df.fillna(0)
print(new_shape)

if original_shape == new_shape:
  print("no duplicate values found")
else:
  print("duplicate values were present and have been removed")

print("Dataset dimensions:", df.shape)

plt.figure(figsize=(8,6))
sb.countplot(x = 'Diabetes_012', data = df, color='lightgreen')
plt.show()

#some error in graph - Age
plt.figure(figsize = (12,5))
for i, col in enumerate (['BMI','PhysHlth','Age']):
  plt.subplot(3,3, i+1)
  sb.boxplot(x=col, data = df, color='lightblue')
plt.show()

plt.figure(figsize = (13,10))
for i, col in enumerate (['BMI','PhysHlth','Age','MentHlth']):
  plt.subplot(2,2, i+1)
  sb.histplot(x=col, data = df, kde= True, color='green')
plt.show()

plt.figure(figsize=(25,20))
sb.heatmap(df.corr(), vmin=-1.0, center=0, cmap='RdBu_r', annot=True)
plt.show()

columns_to_scale = ['HighBP', 'HighChol', 'CholCheck', 'BMI', 'Smoker', 'Stroke',
                    'HeartDiseaseorAttack', 'PhysActivity', 'Fruits', 'Veggies',
                    'HvyAlcoholConsump', 'AnyHealthcare', 'NoDocbcCost', 'GenHlth',
                    'MentHlth', 'PhysHlth', 'DiffWalk', 'Age', 'Education', 'Income']

# Initialize StandardScaler
scaler = StandardScaler()

# Fit and transform the specified columns
scaled_data = scaler.fit_transform(df[columns_to_scale])

# Create a DataFrame with the scaled data
X = pd.DataFrame(scaled_data, columns=columns_to_scale)

# Add the 'Diabetes_012' column to the scaled DataFrame
X['Diabetes_012'] = df['Diabetes_012']

X.head(7)

Y = df["Diabetes_012"]
print(Y)

X.dropna(how='all', inplace=True)  

nan_df = df.isna()
print(nan_df)

df.dropna()

X_train,X_test,Y_train,Y_test = train_test_split (X,Y, test_size=0.3,random_state = 10)

print(X_train)

# Create an instance of SimpleImputer
imputer = SimpleImputer(strategy='mean')
# Fit the imputer on X_train
imputer.fit(X_train)

# Transform X_train
X_train_imputed = imputer.transform(X_train)

# Initialize our DecisionTreeClassifier
classifier = DecisionTreeClassifier()

# Fit your DecisionTreeClassifier on X_train_imputed
classifier.fit(X_train_imputed, Y_train)

X_test_imputed = imputer.transform(X_test)

# Make predictions on the test data  - horizontal printing
predictions_dt = classifier.predict(X_test_imputed)
result_dt = list(zip(Y_test, predictions_dt))
# Print the predictions
print(result_dt)

#can also use this for printing output in a vertical manner

# predictions = classifier.predict(X_test_imputed)
# result = list(zip(Y_test, predictions))
# # Print the predictions
# for original, predicted in result:
#     print(f"Original: {original}, Predicted: {predicted}")

# Calculate accuracy
accuracy = accuracy_score(Y_test, predictions_dt)

# Print the accuracy
print("Accuracy:", accuracy)

# Calculate confusion matrix
conf_matrix = confusion_matrix(Y_test, predictions_dt)

# Print the confusion matrix
print("Confusion Matrix:")
print(conf_matrix)

# Plot confusion matrix as a heatmap
plt.figure(figsize=(8, 6))
sb.heatmap(conf_matrix, annot=True, fmt="d", cmap="Blues", cbar=False)
plt.title("Confusion Matrix")
plt.xlabel("Predicted Labels")
plt.ylabel("True Labels")
plt.show()

# Print classification report
print("report for decision tree.")
print(metrics.classification_report(Y_test, predictions_dt))

imputer = SimpleImputer(strategy='mean')
X_train_imputed = imputer.fit_transform(X_train)

classifier_rf = RandomForestClassifier(n_estimators=10, criterion="entropy")

# Fit your RandomForestClassifier on X_train_imputed
classifier_rf.fit(X_train_imputed, Y_train)

X_test_imputed = imputer.transform(X_test)

# Make predictions on the test data  - horizontal printing
predictions_rf = classifier.predict(X_test_imputed)
result_rf = list(zip(Y_test, predictions_rf))
# Print the predictions
print(result_rf)

# Preprocess X_test similarly to X_train
X_test_imputed = imputer.transform(X_test)

# Predict using the trained classifier
Y_pred = classifier_rf.predict(X_test_imputed)

accuracy = accuracy_score(Y_test, Y_pred)

# Print the accuracy
print("Accuracy:", accuracy)

# Calculate confusion matrix
conf_matrix = confusion_matrix(Y_test, Y_pred)

# Print the confusion matrix
print("Confusion Matrix:")
print(conf_matrix)

# Print classification report
print('classification report for random forest')
print(classification_report(Y_test, Y_pred))

# Compute confusion matrix
conf_matrix = confusion_matrix(Y_test, Y_pred)

# Plot confusion matrix
plt.figure(figsize=(8, 6))
sb.heatmap(conf_matrix, annot=True, fmt='d', cmap="Blues", cbar=False)
plt.xlabel('Predicted labels')
plt.ylabel('True labels')
plt.title('Confusion Matrix')
plt.show()

imputer = SimpleImputer(strategy='mean')
X_train_imputed = imputer.fit_transform(X_train)
X_test_imputed = imputer.transform(X_test)

# Initialize the KNN classifier
k = 3  # Number of neighbors
knn_classifier = KNeighborsClassifier(n_neighbors=k)

# Train the classifier on the training data
knn_classifier.fit(X_train_imputed, Y_train)

# Make predictions on the testing data
y_pred = knn_classifier.predict(X_test_imputed)

X_test_imputed = imputer.transform(X_test)

# Make predictions on the test data  - horizontal printing
predictions_k = classifier.predict(X_test_imputed)
result_k = list(zip(Y_test, predictions_k))
# Print the predictions
print(result_rf)

# Calculate accuracy
accuracy = accuracy_score(Y_test, y_pred)
print("Accuracy:", accuracy)

cm = confusion_matrix(Y_test, y_pred)

print("Confusion Matrix:")
print(cm)

# Generate confusion matrix
cm = confusion_matrix(Y_test, y_pred)

# Plot confusion matrix
plt.figure(figsize=(8, 6))
sb.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False)
plt.xlabel("Predicted Labels")
plt.ylabel("True Labels")
plt.title("Confusion Matrix")
plt.show()

knn_report = classification_report(Y_test, y_pred)

print("Classification Report for KNN:")
print(knn_report)