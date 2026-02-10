#Requires AutoHotkey v2.0
#SingleInstance Force

; Turns the copied table into a spreadsheet
clipboardToMatrix(){
    ; Gets position of the start of the actual data so the extraneous bits can be chopped off
    foundPos := InStr(A_Clipboard, "NAME OF ISSUER", 1)

    ; Removes extraneous bits
    removedHeaderString := SubStr(A_Clipboard, foundPos)

    ; Puts proper header for the value amount
    columnEditedStr := StrReplace(removedHeaderString, "(to the nearest dollar)", "VALUE", 1, ,1)

    ; Puts proper header for shares
    columnEditedStr := StrReplace(columnEditedStr, "PRN AMT", "SHARES", 1, ,1)

    ; Creates an array of each of the 'rows' of the spreadsheet
    rowStrArray := StrSplit(columnEditedStr, "`n")

    matrix := []

    ; Creates the columns by spliting up each of the rows
    For str in rowStrArray{
        matrix.Push(StrSplit(str, A_Tab))
    }

    Return matrix
}

; Turns the spreadsheet into JSON data to more easily remove columns 
matrixToJson(matrix){
    json := []

    For row in matrix {
        ; Skipping the header row
        if(A_Index = 1){
            continue
        } else {
            ; Creates new object and pushes it into json array
            tempObj := Map()

            For entry in row {
                name := (Trim(matrix[1][A_Index]))
                tempObj[name] := Trim(entry)
            }

            json.Push(tempObj)
        }
    }

    return json
}

editingJson(json){

    return json
}
    

; Turns the edited JSON array into neatly formatted CSV data
jsonToCSV(json){
    ; Hardcoding the headers to ensure correct order
    headers := ["NAME OF ISSUER", "CUSIP", "VALUE", "SHARES", "PRN"]
    csvString := ""

    For header in headers{
        csvString .= header
        if(A_Index != headers.Length){
            csvString .= ";"
        }
    }
    
    ; For name in json[1] {
    ;     csvString .= name ''
    ; }
    
    csvString .= "`n"
    
    For obj in json {
        ; MsgBox(A_Index)
        For header in headers {
            Try{
                csvString .= obj[header]
            } Catch {
            }

            if(A_Index != headers.Length){
            csvString .= ";"
            }   
        }
        csvString .= "`n"
    }
    return csvString
}


main(){
    matrix := clipboardToMatrix()
    
    json := matrixToJson(matrix)

    json := editingJson(json)
    
    csvString := jsonToCSV(json)

    A_Clipboard := csvString

    ; Saves CSV data to file
    
    fileSaveLocation := FileSelect("S24", A_Desktop "\sec-data.csv", "Text CSV (*.csv)")

    Try{
        FileDelete(fileSaveLocation)
    } Catch {

    }
    
    Try{
        FileAppend(csvString, fileSaveLocation)     
    } Catch {
        MsgBox("File not saved")
    }
    
    ExitApp()
}

main()