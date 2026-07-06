# Google Docs to DOCX Batch Conversion Checklist

Use this checklist to systematically convert all .gdoc files in the Personnel Committee folder to .docx format.

## Step 1: Identify files to convert
- [ ] List all .gdoc files in the Personnel Committee folder (see list below)
- [ ] Note the folder location for each file

## Google Docs files to convert:

### 0_Admin & Reference/
- [ ] KBC_File_Naming_and_Folder_Guide.gdoc
- [ ] KBC_Personnel_Committee_Operating_Guide.gdoc

### 1_Job Descriptions/0_Working Drafts/
- [ ] 1_Pastor Job Description.gdoc
- [ ] 2_Student Ministry Director Job Description.gdoc
- [ ] 3_Church Clerk Job Description.gdoc
- [ ] 4_Treasurer Job Description.gdoc
- [ ] 5_Young Adult Director Job Description.gdoc
- [ ] 6_Church Administrative Assistant Job Description.gdoc
- [ ] 7_Childrens Ministry Director Job Description.gdoc
- [ ] 8_Custodian Job Description.gdoc

### 2_Evaluation & Accountability Frameworks/
- [ ] 1_Pastor Evaluation & Accountability Framework.gdoc
- [ ] 2_Student Ministry Director Evaluation & Accountability Framework.gdoc
- [ ] 3_Clerk Evaluation & Accountability Framework.gdoc
- [ ] 4_Treasurer Evaluation & Accountability Framework.gdoc
- [ ] 5_Young Adult Pastor Evaluation & Accountability Framework - Copy.gdoc

### 3_Adjustment Plans & Special Policies/
- [ ] 1_Bivocational Adjustment Plan.gdoc

### 4_Committee Working Docs/
- [ ] Job Description for Pastor 2024.gdoc
- [ ] Part-Time Administrative Director Role and Responsibilities One Page Brandon.gdoc
- [ ] Part-Time Student Ministry Director Role and Responsibilities One Page Brandon.gdoc
- [ ] Part-Time Young Adult Ministry Director Role and Responsibilities One Page Brandon.gdoc
- [ ] Personnel Committee Purpose, Goals, and Responsibilities.gdoc

## Step 2: Batch download from Google Drive

For each file above:
1. Open the .gdoc file in Google Drive
2. Click **File > Download > Microsoft Word (.docx)**
3. Save to your Downloads folder (or a temporary folder)
4. Name should match the original (e.g., "KBC_File_Naming_and_Folder_Guide.docx")

## Step 3: Sync the converted files back to local folder

Option A: Manual copy
- [ ] Copy each downloaded .docx file to its corresponding folder in your Personnel Committee directory
- [ ] Replace the .gdoc file by deleting it
- [ ] Wait for Google Drive sync to update (usually 1-2 minutes)

Option B: Use Google Drive sync
- [ ] Let Google Drive automatically sync the downloaded files to your local folder
- [ ] Manually delete the old .gdoc files once .docx versions appear

## Step 4: Update the repository

Option A: Using the Python script
```bash
cd "g:\My Drive\Kingsville Baptist Church\Personnel Committee"
python convert_gdocs.py
```

Option B: Manual git add and commit
```bash
cd "g:\My Drive\Kingsville Baptist Church\Personnel Committee"
git add .
git commit -m "Convert Google Docs to .docx format"
git push
```

## Step 5: Verify

- [ ] All .gdoc files have been replaced with .docx equivalents
- [ ] No .gdoc files remain (except those intentionally excluded in .gitignore)
- [ ] Git commit was successful
- [ ] Changes were pushed to GitHub

## Estimated time
- Download all files: 10-15 minutes
- Sync/copy files: 5 minutes
- Git commit: 2 minutes
- **Total: ~20 minutes**

## Notes
- Keep the .gitignore settings to prevent any new .gdoc shortcuts from being committed
- After conversion, the repository will be much more discoverable and shareable with team members
