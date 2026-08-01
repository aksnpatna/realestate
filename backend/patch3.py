with open("backend/ask/synthesis.py", "r") as f:
    code = f.read()
code = code.replace("except Exception as e:", "except Exception as e:\n        import traceback\n        traceback.print_exc()")
with open("backend/ask/synthesis.py", "w") as f:
    f.write(code)
