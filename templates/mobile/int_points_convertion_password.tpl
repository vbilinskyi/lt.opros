
      <div class="form_row">
        <div class="form_label_long">
          <%e_cms_cons:Password for confirmation%>
        </div>
  
        <div class="form_input m_form">
          <input
            type="password"
            id="pass_<%:password_sfx%>"
            name="pass_<%:password_sfx%>"
            class="inp"
            <%iif:<%getError:pass_<%:password_sfx%>%>,,,style="background: #ff0;" onkeypress="this.style.background='#fff';"%>
          />
        </div>
      </div>
