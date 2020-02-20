module.exports._html = function (response_code,title,reason,orderNumber) {
    return `<html>
        <head>
            <link href="https://fonts.googleapis.com/css?family=Roboto" type="text/css" rel="stylesheet">
            <style type="text/css" media="all">
                *{
                    font-family: 'Roboto', sans-serif;  
                }
                h1{
                    color: ${response_code===1?'#0c991f':'#721c24'};
                }
                p{
                    
                    letter-spacing:  2px;
                    color: #333;
                }
            </style>
        </head>
        <body>
        <h1>${title}</h1>
        ${response_code===1?
            `<p>Te hemos enviado un correo, con la informacion del pago.</p>
             <p><strong>Numero de Orden:</strong>${orderNumber}</p>`
            :`<p>Intenta de nuevo, de persistir el error contacta con el organizador del evento.</p>
              <span>${reason}</span>  `}
        </body>
    </html>`;
 };
 
 module.exports._htmlEmailOnlyPayment = function(firstname,lastname,amount,description,orderNumber){
     return `
     <html>
     <head>
        <link href="https://fonts.googleapis.com/css?family=Roboto" type="text/css" rel="stylesheet">
            
         <style type="text/css" media="all">
             *{
                font-family: 'Roboto', sans-serif;
             }
             h2,strong,span{
                 color:#333;
             }
             h1{
                 color: #2a5934;
             }
             p{
                 
                 letter-spacing:  2px;
                 color: #333;
             }
             #span_yellow{
                 color: #ebeb05;
             }
         </style>
     </head>
     <body>
     <center><h1>Un<span id='span_yellow'>biased</span>, Odontologia Independiente</h1></center>    
     <center><h2>Detalle de Pago: </h2>${orderNumber}</center>
     <strong>Nombres:</strong><span> ${firstname}</span>
     <hr/>
     <strong>Apellidos:</strong><span> ${lastname}</span>
     <hr/>
     <strong>Monto:</strong><span> ${amount}</span>
     <hr/>
     <strong>Descripcion:</strong><span> ${description}</span>
     <hr/>
     <footer>
        <i>Dr. Erick Hernandez</i>
        <div></div>
        <small><a href="mailto:erickimpladent@gmail.com">erickimpladent@gmail.com</a></small>
     </footer>
     </body>
     </html>
     `;
 }