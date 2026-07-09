from utils.doc_parser import DocumentParser

url = "https://smeshjwepztrfnhncnxl.supabase.co/storage/v1/object/public/documents/test.docx"
try:
    print(DocumentParser.parse(url))
except Exception as e:
    print("Error:", e)
